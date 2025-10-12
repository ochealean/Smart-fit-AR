import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

// Your web app's Firebase configuration for DeepAR models
const deepARFirebaseConfig = {
  apiKey: "AIzaSyDC2Hmrq31OrVV-dMYsb9ak4Uq6NhLYeQ8",
  authDomain: "smartfit-deepar-model.firebaseapp.com",
  projectId: "smartfit-deepar-model",
  storageBucket: "smartfit-deepar-model.firebasestorage.app",
  messagingSenderId: "419944191055",
  appId: "1:419944191055:web:0706b4c28bc11cd2e2463a"
};

// Initialize Firebase with a unique name for DeepAR storage
let deepARApp;
let deepARStorage;

try {
  // Try to get existing app first, if it exists
  deepARApp = initializeApp(deepARFirebaseConfig, 'DeepARStorage');
  deepARStorage = getStorage(deepARApp);
  console.log('DeepAR Firebase app initialized successfully');
} catch (error) {
  if (error.code === 'app/duplicate-app') {
    // If app already exists, get it by name
    deepARApp = initializeApp(deepARFirebaseConfig, 'DeepARStorage');
    deepARStorage = getStorage(deepARApp);
    console.log('DeepAR Firebase app retrieved successfully');
  } else {
    console.error('Error initializing DeepAR Firebase:', error);
    throw error;
  }
}

// Firebase Storage CRUD Operations
export const storageService = {
  // CREATE - Upload file to storage
  uploadFile: async (file, filePath, onProgress = null, onError = null, onComplete = null) => {
    try {
      const ref = storageRef(deepARStorage, filePath);
      const uploadTask = uploadBytesResumable(ref, file);

      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            // Progress monitoring
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) onProgress(progress);
          },
          (error) => {
            if (onError) onError(error);
            reject(error);
          },
          async () => {
            // Upload completed successfully
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              if (onComplete) onComplete(downloadURL);
              resolve({
                success: true,
                downloadURL,
                ref: uploadTask.snapshot.ref,
                metadata: uploadTask.snapshot.metadata
              });
            } catch (error) {
              if (onError) onError(error);
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      throw error;
    }
  },

  // READ - Get download URL for a file
  getFileURL: async (filePath) => {
    try {
      const ref = storageRef(deepARStorage, filePath);
      const downloadURL = await getDownloadURL(ref);
      return {
        success: true,
        downloadURL,
        ref
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // READ - List files in a directory
  listFiles: async (directoryPath = '') => {
    try {
      const ref = storageRef(deepARStorage, directoryPath);
      const result = await listAll(ref);
      
      const items = await Promise.all(
        result.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          return {
            name: itemRef.name,
            fullPath: itemRef.fullPath,
            downloadURL: url,
            ref: itemRef
          };
        })
      );

      const prefixes = result.prefixes.map(prefixRef => ({
        name: prefixRef.name,
        fullPath: prefixRef.fullPath,
        isDirectory: true,
        ref: prefixRef
      }));

      return {
        success: true,
        files: items,
        directories: prefixes
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        files: [],
        directories: []
      };
    }
  },

  // UPDATE - Replace existing file (upload new version)
  updateFile: async (file, filePath, onProgress = null, onError = null, onComplete = null) => {
    // For Firebase Storage, updating a file means uploading a new version to the same path
    return storageService.uploadFile(file, filePath, onProgress, onError, onComplete);
  },

  // DELETE - Remove file from storage
  deleteFile: async (filePath) => {
    try {
      const ref = storageRef(deepARStorage, filePath);
      await deleteObject(ref);
      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // DELETE - Remove multiple files
  deleteMultipleFiles: async (filePaths) => {
    try {
      const results = await Promise.allSettled(
        filePaths.map(filePath => storageService.deleteFile(filePath))
      );

      const successfulDeletes = results.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length;

      const failedDeletes = results.filter(result => 
        result.status === 'rejected' || !result.value.success
      );

      return {
        success: failedDeletes.length === 0,
        total: filePaths.length,
        successful: successfulDeletes,
        failed: failedDeletes.length,
        errors: failedDeletes.map(failed => failed.reason || failed.value.error)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Utility function to get file metadata (file size, type, etc.)
  getFileMetadata: async (filePath) => {
    try {
      const ref = storageRef(deepARStorage, filePath);
      // Note: For detailed metadata, you might need to use additional Firebase Storage methods
      // This returns basic information available through the ref
      return {
        success: true,
        metadata: {
          name: ref.name,
          fullPath: ref.fullPath,
          bucket: ref.bucket
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Export the storage instance for direct access if needed
export { deepARStorage };

// Usage Examples:
/*
// Upload a file
storageService.uploadFile(
  file, 
  'images/profile.jpg',
  (progress) => console.log(`Upload progress: ${progress}%`),
  (error) => console.error('Upload error:', error),
  (url) => console.log('File available at:', url)
);

// Get file URL
const result = await storageService.getFileURL('images/profile.jpg');
if (result.success) {
  console.log('File URL:', result.downloadURL);
}

// List files in directory
const files = await storageService.listFiles('images/');
console.log('Files:', files.files);

// Delete file
const deleteResult = await storageService.deleteFile('images/old-profile.jpg');
if (deleteResult.success) {
  console.log('File deleted successfully');
}
*/