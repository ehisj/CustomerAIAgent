<template>
  <div class="document-library">
    <!-- Upload Section -->
    <section class="upload-section">
      <h2>Upload Documents</h2>
      <div
        class="drop-zone"
        :class="{ 'drag-over': isDragOver, 'uploading': isUploading }"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
        role="button"
        tabindex="0"
        @keydown.enter="triggerFileInput"
        @keydown.space.prevent="triggerFileInput"
        aria-label="Upload documents"
      >
        <input
          ref="fileInput"
          type="file"
          :accept="acceptedTypes"
          multiple
          @change="handleFileSelect"
          class="hidden-input"
          aria-hidden="true"
        />
        <div v-if="isUploading" class="upload-progress">
          <div class="spinner"></div>
          <p>Uploading {{ uploadingFileName }}...</p>
          <p class="progress-text">{{ uploadProgress }}%</p>
        </div>
        <div v-else class="drop-zone-content">
          <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17,8 12,3 7,8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p class="drop-text">
            <strong>Drag & drop files here</strong>
            <span>or click to browse</span>
          </p>
          <p class="supported-formats">Supported: .txt, .doc, .docx, .pdf</p>
        </div>
      </div>
    </section>

    <!-- Toast Notifications -->
    <div class="toast-container" aria-live="polite">
      <transition-group name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
          role="alert"
        >
          <span class="toast-icon">{{ toast.type === 'success' ? '✓' : '✕' }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <button @click="removeToast(toast.id)" class="toast-close" aria-label="Dismiss">&times;</button>
        </div>
      </transition-group>
    </div>

    <!-- Documents Section -->
    <section class="documents-section">
      <div class="section-header">
        <h2>Document Library</h2>
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search documents..."
            class="search-input"
            aria-label="Search documents"
          />
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="stats-bar" v-if="documents.length > 0">
        <span>{{ filteredDocuments.length }} document{{ filteredDocuments.length !== 1 ? 's' : '' }}</span>
        <span class="separator">|</span>
        <span>{{ totalChunks }} total chunks</span>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading documents...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="documents.length === 0" class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
        <p>No documents uploaded yet</p>
        <p class="hint">Upload your first document to get started</p>
      </div>

      <!-- No Results State -->
      <div v-else-if="filteredDocuments.length === 0" class="empty-state">
        <p>No documents match "{{ searchQuery }}"</p>
        <button @click="searchQuery = ''" class="clear-search-btn">Clear search</button>
      </div>

      <!-- Documents Table -->
      <div v-else class="table-container">
        <table class="documents-table" role="grid">
          <thead>
            <tr>
              <th @click="sortBy('filename')" class="sortable" role="columnheader" aria-sort="none">
                <span>Filename</span>
                <span class="sort-indicator" v-if="sortKey === 'filename'">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </th>
              <th>Type</th>
              <th @click="sortBy('uploadedAt')" class="sortable" role="columnheader" aria-sort="none">
                <span>Uploaded</span>
                <span class="sort-indicator" v-if="sortKey === 'uploadedAt'">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </th>
              <th>Chunks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="doc in filteredDocuments" :key="doc.documentId" role="row">
              <td class="filename-cell">
                <span class="file-icon">{{ getFileIcon(doc.filetype) }}</span>
                <span class="filename" :title="doc.filename">{{ doc.filename }}</span>
              </td>
              <td>
                <span class="filetype-badge">{{ doc.filetype.toUpperCase() }}</span>
              </td>
              <td>{{ formatDate(doc.uploadedAt) }}</td>
              <td>{{ doc.chunkCount }}</td>
              <td class="actions-cell">
                <button
                  @click="confirmDelete(doc)"
                  class="delete-btn"
                  :disabled="deletingId === doc.documentId"
                  aria-label="Delete document"
                >
                  <span v-if="deletingId === doc.documentId" class="btn-spinner"></span>
                  <span v-else>Delete</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="cancelDelete">
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <h3 id="modal-title">Delete Document</h3>
          <p>Are you sure you want to delete <strong>{{ documentToDelete?.filename }}</strong>?</p>
          <p class="modal-warning">This will remove all {{ documentToDelete?.chunkCount }} chunks from the vector database. This action cannot be undone.</p>
          <div class="modal-actions">
            <button @click="cancelDelete" class="btn btn-secondary" ref="cancelBtn">Cancel</button>
            <button @click="executeDelete" class="btn btn-danger" :disabled="isDeleting">
              {{ isDeleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';

const API_BASE = '/api/documents';

// State
const documents = ref([]);
const isLoading = ref(true);
const isUploading = ref(false);
const uploadingFileName = ref('');
const uploadProgress = ref(0);
const searchQuery = ref('');
const sortKey = ref('uploadedAt');
const sortOrder = ref('desc');
const toasts = ref([]);
const fileInput = ref(null);
const isDragOver = ref(false);

// Delete modal state
const showDeleteModal = ref(false);
const documentToDelete = ref(null);
const isDeleting = ref(false);
const deletingId = ref(null);
const cancelBtn = ref(null);

// Accepted file types
const acceptedTypes = '.txt,.doc,.docx,.pdf';

// Computed
const totalChunks = computed(() => {
  return documents.value.reduce((sum, doc) => sum + doc.chunkCount, 0);
});

const filteredDocuments = computed(() => {
  let filtered = [...documents.value];

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(doc =>
      doc.filename.toLowerCase().includes(query)
    );
  }

  // Sort
  filtered.sort((a, b) => {
    let aVal = a[sortKey.value];
    let bVal = b[sortKey.value];

    if (sortKey.value === 'uploadedAt') {
      aVal = new Date(aVal || 0);
      bVal = new Date(bVal || 0);
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortOrder.value === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return filtered;
});

// Focus management for modal
watch(showDeleteModal, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    cancelBtn.value?.focus();
  }
});

// Methods
async function loadDocuments() {
  isLoading.value = true;
  try {
    const response = await fetch(API_BASE);
    if (!response.ok) throw new Error('Failed to load documents');
    const data = await response.json();
    documents.value = data.documents || [];
  } catch (error) {
    showToast('Failed to load documents', 'error');
    console.error('Load documents error:', error);
  } finally {
    isLoading.value = false;
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(event) {
  const files = event.target.files;
  if (files.length > 0) {
    uploadFiles(Array.from(files));
  }
  // Reset input
  event.target.value = '';
}

function handleDrop(event) {
  isDragOver.value = false;
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    uploadFiles(Array.from(files));
  }
}

async function uploadFiles(files) {
  const validExtensions = ['.txt', '.doc', '.docx', '.pdf'];

  for (const file of files) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExtensions.includes(ext)) {
      showToast(`Invalid file type: ${file.name}. Supported: ${validExtensions.join(', ')}`, 'error');
      continue;
    }

    await uploadSingleFile(file);
  }
}

async function uploadSingleFile(file) {
  isUploading.value = true;
  uploadingFileName.value = file.name;
  uploadProgress.value = 0;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        uploadProgress.value = Math.round((event.loaded / event.total) * 100);
      }
    });

    // Wrap in promise
    const response = await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.open('POST', `${API_BASE}/upload`);
      xhr.send(formData);
    });

    showToast(`Uploaded ${file.name} (${response.chunksInserted} chunks)`, 'success');
    await loadDocuments();
  } catch (error) {
    showToast(error.message || `Failed to upload ${file.name}`, 'error');
    console.error('Upload error:', error);
  } finally {
    isUploading.value = false;
    uploadingFileName.value = '';
    uploadProgress.value = 0;
  }
}

function sortBy(key) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'desc';
  }
}

function confirmDelete(doc) {
  documentToDelete.value = doc;
  showDeleteModal.value = true;
}

function cancelDelete() {
  showDeleteModal.value = false;
  documentToDelete.value = null;
}

async function executeDelete() {
  if (!documentToDelete.value) return;

  isDeleting.value = true;
  deletingId.value = documentToDelete.value.documentId;

  try {
    const response = await fetch(`${API_BASE}/${documentToDelete.value.documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Delete failed');
    }

    const result = await response.json();
    showToast(`Deleted ${documentToDelete.value.filename} (${result.chunksDeleted} chunks)`, 'success');
    await loadDocuments();
  } catch (error) {
    showToast(error.message || 'Failed to delete document', 'error');
    console.error('Delete error:', error);
  } finally {
    isDeleting.value = false;
    deletingId.value = null;
    showDeleteModal.value = false;
    documentToDelete.value = null;
  }
}

function showToast(message, type = 'success') {
  const id = Date.now();
  toasts.value.push({ id, message, type });

  // Auto-remove after 5 seconds
  setTimeout(() => {
    removeToast(id);
  }, 5000);
}

function removeToast(id) {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index > -1) {
    toasts.value.splice(index, 1);
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileIcon(filetype) {
  const icons = {
    txt: '📄',
    doc: '📝',
    docx: '📝',
    pdf: '📕',
  };
  return icons[filetype] || '📄';
}

// Lifecycle
onMounted(() => {
  loadDocuments();
});
</script>

<style scoped>
.document-library {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Upload Section */
.upload-section h2 {
  margin-bottom: 1rem;
  color: #1f2937;
  font-size: 1.25rem;
}

.drop-zone {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
}

.drop-zone:hover,
.drop-zone:focus {
  border-color: #667eea;
  background: #f0f2ff;
  outline: none;
}

.drop-zone.drag-over {
  border-color: #667eea;
  background: #e8ebff;
  transform: scale(1.01);
}

.drop-zone.uploading {
  cursor: wait;
  opacity: 0.8;
}

.hidden-input {
  display: none;
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upload-icon {
  width: 48px;
  height: 48px;
  color: #667eea;
  margin-bottom: 0.5rem;
}

.drop-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.drop-text strong {
  color: #1f2937;
  font-size: 1.1rem;
}

.drop-text span {
  color: #6b7280;
  font-size: 0.9rem;
}

.supported-formats {
  color: #9ca3af;
  font-size: 0.8rem;
  margin-top: 0.5rem;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.progress-text {
  font-weight: 600;
  color: #667eea;
}

/* Spinner */
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e0e0e0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Toast Notifications */
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 280px;
  max-width: 400px;
}

.toast-success {
  background: #dcfce7;
  color: #166534;
}

.toast-error {
  background: #fee2e2;
  color: #b91c1c;
}

.toast-icon {
  font-weight: bold;
  font-size: 1.1rem;
}

.toast-message {
  flex: 1;
  font-size: 0.9rem;
}

.toast-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  opacity: 0.6;
  padding: 0;
  line-height: 1;
}

.toast-close:hover {
  opacity: 1;
}

/* Toast animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* Documents Section */
.documents-section h2 {
  color: #1f2937;
  font-size: 1.25rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.search-box {
  position: relative;
  width: 100%;
  max-width: 300px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: #9ca3af;
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
}

.stats-bar {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.separator {
  margin: 0 0.5rem;
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #6b7280;
  gap: 0.75rem;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: #d1d5db;
}

.hint {
  font-size: 0.9rem;
  color: #9ca3af;
}

.clear-search-btn {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
}

.clear-search-btn:hover {
  background: #5a6fd6;
}

/* Table */
.table-container {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.documents-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.documents-table th {
  background: #f9fafb;
  text-align: left;
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.documents-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.documents-table th.sortable:hover {
  background: #f3f4f6;
}

.sort-indicator {
  margin-left: 0.25rem;
  color: #667eea;
}

.documents-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
}

.documents-table tr:last-child td {
  border-bottom: none;
}

.documents-table tr:hover {
  background: #f9fafb;
}

.filename-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 250px;
}

.file-icon {
  font-size: 1.1rem;
}

.filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filetype-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: #e5e7eb;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #374151;
}

.actions-cell {
  white-space: nowrap;
}

.delete-btn {
  padding: 0.375rem 0.75rem;
  background: #fee2e2;
  color: #b91c1c;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: background 0.2s;
  min-width: 60px;
}

.delete-btn:hover:not(:disabled) {
  background: #fecaca;
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 1rem;
}

.modal {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal h3 {
  margin: 0 0 1rem;
  color: #1f2937;
}

.modal p {
  margin: 0 0 0.75rem;
  color: #4b5563;
  line-height: 1.5;
}

.modal-warning {
  font-size: 0.875rem;
  color: #92400e;
  background: #fef3c7;
  padding: 0.75rem;
  border-radius: 6px;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  border: none;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 640px) {
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: none;
  }

  .documents-table {
    font-size: 0.8rem;
  }

  .documents-table th,
  .documents-table td {
    padding: 0.5rem;
  }

  .filename-cell {
    max-width: 150px;
  }

  .drop-zone {
    padding: 1.5rem;
  }

  .toast {
    min-width: auto;
    max-width: none;
    margin: 0 1rem;
  }
}
</style>
