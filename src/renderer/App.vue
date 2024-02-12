<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { createClient } from '@supabase/supabase-js'
import VuePdfEmbed from 'vue-pdf-embed'

// essential styles
import 'vue-pdf-embed/dist/style/index.css'

const visible = ref(false);
const images = ref<{ name: string, id: string | null, url: string, meta: Record<string, any>, type: string }[]>([])
const selectedImage = ref<string | null>(null)
const selectedMeta = ref<Record<string, any> | null>(null)
const selectedName = ref<string | null>(null)
const selectedType = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const loading = ref(false)

const folderName = ref<string[]>([])

const filecount = ref<number | null>(null)

const supabaseUrl = localStorage.getItem('supabaseUrl')
const anonKey = localStorage.getItem('anonKey')

const inputSupabaseUrl = ref(supabaseUrl || '')
const inputAnonKey = ref(anonKey || '')


type Meta = {
  eTag: string,
  size: number,
  mimetype: string,
  cacheControl: string,
  lastModified: string,
  controlLength: number,
  httpStatusCode: number,
}

onMounted(async () => {
  if (supabaseUrl && anonKey) {
    const supabase = createClient(inputSupabaseUrl.value, inputAnonKey.value)
    loading.value = true
    const { data: files, error: filesError } = await supabase.storage.from('pic').list()
    if (files) {
      filecount.value = files.length
    }
    if (files) {
      images.value = files
        .map(file => {
          const { data } = supabase.storage.from('pic').getPublicUrl(file.name)
          const fileType = file.name?.split('.').pop() ?? ''
          return { name: file.name, id: file.id, url: data.publicUrl, meta: file.metadata, type: fileType }
        })
    }
    loading.value = false
  }
})

const handleClick = (url: string, meta: any, name: string, type: string) => {
  visible.value = true;
  selectedImage.value = url;
  selectedMeta.value = meta;
  selectedName.value = name;
  window.electronAPI.sendMessage(JSON.stringify(meta))
  window.electronAPI.sendMessage(type)
};

const handleOk = () => {
  visible.value = false;
};

const handleCancel = () => {
  visible.value = false;
}


const saveCredentials = () => {
  localStorage.setItem('supabaseUrl', inputSupabaseUrl.value)
  localStorage.setItem('anonKey', inputAnonKey.value)
  window.location.reload(); // Reload the page after saving credentials
}

// const handle = async () => {
//   const supabase = createClient(inputSupabaseUrl.value, inputAnonKey.value)
//   const { data: files, error: filesError } = await supabase.storage.from('pic').list('folder')
//   window.electronAPI.sendMessage(JSON.stringify(files))
// }


const triggerFileInput = () => {
  fileInput.value?.click()
}


const uploadImage = async (event: Event) => {
  const supabase = createClient(inputSupabaseUrl.value, inputAnonKey.value)
  const file = (event.target as HTMLInputElement).files![0]
  const fileName = file.name
  const filePath = `${folderName.value.join('/')}/${fileName}`
  const { error } = await supabase.storage.from('pic').upload(filePath, file)
  if (error) {
    window.electronAPI.sendMessage(error.message)
  } else {
    const { data } = await supabase.storage.from('pic').getPublicUrl(filePath)
    window.location.reload();
    //images.value.push({ name: fileName, id: 'xxx', url: data.publicUrl })
  }
}


const deleteSelectedImage = async () => {
  window.electronAPI.sendMessage('Deleting image...')
  window.electronAPI.sendMessage(JSON.stringify(selectedImage.value))
  if (selectedImage.value) {
    const supabase = createClient(inputSupabaseUrl.value, inputAnonKey.value)
    const fileName = selectedImage.value.split('/').pop()
    const { error } = await supabase.storage.from('pic').remove([fileName!])
    if (error) {
      window.electronAPI.sendMessage(error.message)
    } else {
      images.value = images.value.filter(image => image.url !== selectedImage.value)
      selectedImage.value = null
      visible.value = false;
    }
  }
}


const fetchFolder = async (name: string) => {
  const supabase = createClient(inputSupabaseUrl.value, inputAnonKey.value)
  loading.value = true
  images.value = []
  folderName.value.push(name)
  const { data, error } = await supabase.storage.from('pic').list(name)
  if (data) {
    images.value = data
      .map(file => {
        const { data } = supabase.storage.from('pic').getPublicUrl(`${name}/${file.name}`)
        return { name: file.name, id: file.id, url: data.publicUrl, meta: file.metadata, type: file.name.split('.').pop() ?? '' }
      })
  }
  loading.value = false
}

const back = async () => {
  const supabase = createClient(inputSupabaseUrl.value, inputAnonKey.value)
  loading.value = true
  images.value = []
  folderName.value.pop()

  const { data: files, error: filesError } = await supabase.storage.from('pic').list(folderName.value.join('/'))
  if (files) {
    images.value = files
      .map(file => {
        const { data } = supabase.storage.from('pic').getPublicUrl(file.name)
        return { name: file.name, id: file.id, url: data.publicUrl, meta: file.metadata, type: file.name.split('.').pop() ?? '' }
      })
  }

  loading.value = false
}


const handleImageError = (event: Event) => {
  // Set a fallback image
  window.electronAPI.sendMessage("error image");
  (event.target as HTMLImageElement).src = 'icon.png';
  // Or display an error message
  // (event.target as HTMLImageElement).alt = 'Image failed to load';
}



const compressImage = async (imageUrl: string) => {
  // Fetch the image
  window.electronAPI.sendMessage('Compressing image...')
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  // Create an off-screen image element
  const img = document.createElement('img');
  img.src = URL.createObjectURL(blob);
  await new Promise(resolve => img.onload = resolve);
  // Create a canvas and draw the image onto it
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to get 2D context');
  }
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // Compress the image
  const compressedImageDataURL = canvas.toDataURL('image/jpeg', 0.8);
  // Convert the data URL to a Blob
  const compressedImageResponse = await fetch(compressedImageDataURL);
  const compressedImageBlob = await compressedImageResponse.blob();
  // Upload the compressed image
  await deleteSelectedImage()
  window.electronAPI.sendMessage('delete and upload...')
  setTimeout(() => { }, 1500)
  const supabase = createClient(inputSupabaseUrl.value, inputAnonKey.value);
  const fileName = imageUrl.split('/').pop();
  const filePath = `${folderName.value.join('/')}/${fileName}`;
  const { error } = await supabase.storage.from('pic').upload(filePath, compressedImageBlob);
  if (error) {
    window.electronAPI.sendMessage("same ");
    window.electronAPI.sendMessage(error.message);
  } else {
    const { data } = await supabase.storage.from('pic').getPublicUrl(filePath);
    window.location.reload();
    //images.value.push({ name: fileName, id: 'xxx', url: data.publicUrl });
  }
}



</script>

<template>
  <div>
    <div v-if="!supabaseUrl || !anonKey" class="credentials-input">
      <input v-model="inputSupabaseUrl" placeholder="Enter Supabase URL" class="input-field" />
      <input v-model="inputAnonKey" placeholder="Enter Anon Key" class="input-field" />
      <button @click="saveCredentials" class="save-button">Save</button>
    </div>
    <!-- <button @click="handle">button</button> -->
    <div v-else>
      <div class="back" v-if="folderName.length > 0" @click="back">
        <svg t="1706690302238" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
          p-id="5338" width="30" height="30">
          <path
            d="M395.21518 513.604544l323.135538-312.373427c19.052938-18.416442 19.052938-48.273447 0-66.660212-19.053961-18.416442-49.910737-18.416442-68.964698 0L291.75176 480.290811c-19.052938 18.416442-19.052938 48.273447 0 66.660212l357.633237 345.688183c9.525957 9.207709 22.01234 13.796214 34.497699 13.796214 12.485359 0 24.971741-4.588505 34.466999-13.82896 19.052938-18.416442 19.052938-48.242747 0-66.660212L395.21518 513.604544z"
            fill="#1296db" p-id="5339"></path>
        </svg>
      </div>
      <!-- <input type="file" @change="uploadImage" /> -->
      <div class="image-grid">
        <div v-for="(image, index) in images" :key="index">
          <div v-if="image.id">
            <!-- <img class="grid-item" v-if="!image.url" src="placeholder.png" alt="Placeholder image" /> -->
            <div class="image-container">
              <div v-if="image.type === 'pdf'" class="grid-item"  @click="handleClick(image.url, image.meta, image.name, image.type)">PDF</div>
              <img v-else class="grid-item" :src="image.url" alt="Downloaded image"
                @click="handleClick(image.url, image.meta, image.name, image.type)" @error="handleImageError" />
            </div>
            <div>{{ image.name }}</div>
          </div>
          <div v-else @click="fetchFolder(image.name)">
            <svg t="1706687603316" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4257">
              <path
                d="M987.428571 347.428571v402.285715q0 52.571429-37.714285 90.285714t-90.285715 37.714286H164.571429q-52.571429 0-90.285715-37.714286T36.571429 749.714286V201.142857q0-52.571429 37.714285-90.285714t90.285715-37.714286h182.857142q52.571429 0 90.285715 37.714286t37.714285 90.285714v18.285714h384q52.571429 0 90.285715 37.714286t37.714285 90.285714z"
                p-id="4258" fill="#1296db" class="grid-item"></path>
            </svg>
            <div>{{ image.name }}</div>
          </div>
        </div>
      </div>
      <div class="spin" v-show="loading">
        <a-spin />
      </div>
      <a-drawer :width="340" :visible="visible" @ok="handleOk" @cancel="handleCancel" unmountOnClose>
        <template #title>
          <div v-if="selectedName">
            {{ selectedName }}
          </div>
        </template>
        <div>
          <div>
            <!-- <div v-if="selectedType != 'pdf'">pdf</div> -->
            <VuePdfEmbed annotation-layer text-layer :source="selectedImage" />
            <!-- <embed v-if="selectedType != 'pdf' && selectedImage" :src="selectedImage" class="selected-image" style="height: 500px" /> -->
            <!-- <img v-show="selectedType !== 'pdf'" :src="selectedImage || ''" alt="Selected image" class="selected-image" /> -->
          </div>
          <div v-if="selectedMeta">{{ (selectedMeta.size / (1024 * 1024)).toFixed(3) }} MB</div>
          <button v-if="selectedImage && selectedMeta && selectedMeta.size > 0.8 * 1024 * 1024"
            @click="compressImage(selectedImage)" style="margin-right: 11px;">compress Image</button>
          <button v-if="selectedImage" @click="deleteSelectedImage">Delete Image</button>
        </div>
      </a-drawer>
      <div class="icon-container" @click="triggerFileInput">
        <input type="file" @change="uploadImage" ref="fileInput" style="display: none" />
        <svg t="1706686211225" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
          p-id="4202" width="35" height="35">
          <path
            d="M512 1024C229.229714 1024 0 794.770286 0 512S229.229714 0 512 0s512 229.229714 512 512-229.229714 512-512 512z m0-928C282.258286 96 96 282.258286 96 512S282.258286 928 512 928 928 741.741714 928 512 741.741714 96 512 96z m208.018286 463.981714h-160v160.036572a48.018286 48.018286 0 0 1-96.036572 0v-160.036572H303.981714a47.981714 47.981714 0 0 1 0-95.963428h160V304.018286a48.018286 48.018286 0 0 1 96.036572 0v160h160a47.981714 47.981714 0 0 1 0 95.963428z"
            fill="#1296db" p-id="4203"></path>
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* input logic */
.credentials-input {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
}

.input-field {
  width: 300px;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
}

.save-button {
  padding: 10px 20px;
  border-radius: 5px;
  border: none;
  background-color: #4CAF50;
  color: white;
  cursor: pointer;
}

.save-button:hover {
  background-color: #45a049;
}


.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.image-container {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  /* This creates a square container */
  overflow: hidden;
}

.image-container img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}


.grid-item {
  width: 100%;
  height: auto;
  object-fit: cover;
  cursor: pointer;
}

.selected-image {
  max-width: 100%;
}

.icon-container {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  cursor: pointer;
}

.back {
  position: fixed;
  left: 2%;
  top: 20px;
  cursor: pointer;
}

.spin {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
