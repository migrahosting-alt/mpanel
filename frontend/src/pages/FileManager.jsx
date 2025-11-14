import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';
import {
  FolderIcon,
  DocumentIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  PencilIcon,
  TrashIcon,
  FolderPlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  HomeIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  Cog6ToothIcon,
  SparklesIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function FileManager() {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMkdirModal, setShowMkdirModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedAiFile, setSelectedAiFile] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newDirName, setNewDirName] = useState('');
  const [permissions, setPermissions] = useState('755');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFiles();
  }, [currentPath]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/files/browse', {
        params: { path: currentPath }
      });
      setFiles(response.files);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderPath) => {
    if (folderPath === '..') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      setCurrentPath(parts.join('/'));
    } else {
      setCurrentPath(folderPath);
    }
  };

  const handleFileSelect = (file) => {
    if (selectedFiles.find(f => f.path === file.path)) {
      setSelectedFiles(selectedFiles.filter(f => f.path !== file.path));
    } else {
      setSelectedFiles([...selectedFiles, file]);
    }
  };

  const handleUpload = async (event) => {
    const uploadedFiles = Array.from(event.target.files);
    
    if (uploadedFiles.length === 0) return;

    const formData = new FormData();
    uploadedFiles.forEach(file => {
      formData.append('files', file);
    });
    formData.append('path', currentPath);

    try {
      // Use fetch directly for multipart/form-data (apiClient doesn't handle FormData yet)
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/files/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      toast.success('Files uploaded successfully');
      fetchFiles();
      setShowUploadModal(false);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
    }
  };

  const handleDownload = async (file) => {
    try {
      // Use fetch directly for blob downloads
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/files/download?path=${encodeURIComponent(file.path.replace(/^.*\/var\/www\/[^/]+\/[^/]+\//, ''))}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/octet-stream' }
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const handleEdit = async (file) => {
    try {
      const response = await apiClient.get('/files/content', {
        params: { path: file.path.replace(/^.*\/var\/www\/[^/]+\/[^/]+\//, '') }
      });
      setEditingFile(file);
      setFileContent(response.content);
      setShowEditorModal(true);
    } catch (error) {
      console.error('Error loading file:', error);
      toast.error('Failed to load file content');
    }
  };

  const handleSaveFile = async () => {
    try {
      await apiClient.post('/files/content', {
        path: editingFile.path.replace(/^.*\/var\/www\/[^/]+\/[^/]+\//, ''),
        content: fileContent
      });
      toast.success('File saved successfully');
      setShowEditorModal(false);
      fetchFiles();
    } catch (error) {
      console.error('Error saving file:', error);
      toast.error('Failed to save file');
    }
  };

  const handleDelete = async (file) => {
    if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;

    try {
      await apiClient.delete('/files/delete', {
        data: { path: file.path.replace(/^.*\/var\/www\/[^/]+\/[^/]+\//, '') }
      });
      toast.success('Deleted successfully');
      setSelectedFiles([]);
      fetchFiles();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const handleCreateDirectory = async () => {
    if (!newDirName.trim()) return;

    try {
      await apiClient.post('/files/mkdir', {
        path: currentPath,
        name: newDirName
      });
      toast.success('Directory created successfully');
      setNewDirName('');
      setShowMkdirModal(false);
      fetchFiles();
    } catch (error) {
      console.error('Error creating directory:', error);
      toast.error('Failed to create directory');
    }
  };

  const handleChangePermissions = async () => {
    if (selectedFiles.length === 0) return;

    try {
      await Promise.all(selectedFiles.map(file =>
        apiClient.post('/files/chmod', {
          path: file.path.replace(/^.*\/var\/www\/[^/]+\/[^/]+\//, ''),
          permissions
        })
      ));
      toast.success('Permissions updated successfully');
      setShowPermissionsModal(false);
      setSelectedFiles([]);
      fetchFiles();
    } catch (error) {
      console.error('Error changing permissions:', error);
      toast.error('Failed to change permissions');
    }
  };

  const handleCompress = async () => {
    if (selectedFiles.length === 0) return;

    const archiveName = prompt('Enter archive name:', 'archive.zip');
    if (!archiveName) return;

    try {
      const paths = selectedFiles.map(f => f.path.replace(/^.*\/var\/www\/[^/]+\/[^/]+\//, ''));
      await apiClient.post('/files/compress', {
        paths,
        archiveName,
        format: archiveName.endsWith('.tar.gz') ? 'tar.gz' : 'zip'
      });
      toast.success('Archive created successfully');
      setSelectedFiles([]);
      fetchFiles();
    } catch (error) {
      console.error('Error creating archive:', error);
      toast.error('Failed to create archive');
    }
  };

  const handleExtract = async (file) => {
    if (!confirm(`Extract ${file.name} here?`)) return;

    try {
      await apiClient.post('/files/extract', {
        path: file.path.replace(/^.*\/var\/www\/[^/]+\/[^/]+\//, ''),
        destination: currentPath
      });
      toast.success('Archive extracted successfully');
      fetchFiles();
    } catch (error) {
      console.error('Error extracting archive:', error);
      toast.error('Failed to extract archive');
    }
  };

  const handleAskAI = (file) => {
    setSelectedAiFile(file);
    setAiQuestion('');
    setAiResponse('');
    setShowAiModal(true);
  };

  const handleAiSubmit = async () => {
    if (!selectedAiFile) return;
    
    setAiLoading(true);
    setAiResponse('');
    
    try {
      const response = await apiClient.post('/ai/files/explain', {
        path: selectedAiFile.path,
        question: aiQuestion || undefined
      });
      setAiResponse(response.explanation || JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Error asking AI:', error);
      setAiResponse(error.response?.data?.error || 'AI service unavailable. Make sure OPENAI_API_KEY is configured.');
    } finally {
      setAiLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: 'Home', path: '' }];
    const parts = currentPath.split('/').filter(Boolean);
    return [
      { name: 'Home', path: '' },
      ...parts.map((part, i) => ({
        name: part,
        path: parts.slice(0, i + 1).join('/')
      }))
    ];
  };

  const isTextFile = (filename) => {
    const textExtensions = ['.txt', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss', '.xml', '.md', '.yml', '.yaml', '.ini', '.conf', '.sh', '.py', '.php'];
    return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  const isArchive = (filename) => {
    const archiveExtensions = ['.zip', '.tar', '.tar.gz', '.tgz', '.gz'];
    return archiveExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">File Manager</h1>
        <p className="mt-2 text-sm text-gray-600">
          Browse, upload, edit, and manage your files
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
              Upload
            </button>
            <button
              onClick={() => setShowMkdirModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <FolderPlusIcon className="h-5 w-5 mr-2" />
              New Folder
            </button>
            <button
              onClick={fetchFiles}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              Refresh
            </button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleCompress}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArchiveBoxIcon className="h-5 w-5 mr-2" />
                Compress
              </button>
              <button
                onClick={() => setShowPermissionsModal(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Cog6ToothIcon className="h-5 w-5 mr-2" />
                Permissions
              </button>
              <span className="text-sm text-gray-600 py-2 px-3">
                {selectedFiles.length} selected
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            {getBreadcrumbs().map((crumb, index) => (
              <li key={index} className="flex items-center">
                {index > 0 && <ChevronRightIcon className="h-4 w-4 text-gray-400 mx-2" />}
                <button
                  onClick={() => setCurrentPath(crumb.path)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  {index === 0 ? <HomeIcon className="h-5 w-5" /> : crumb.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* File List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading files...</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles(files);
                      } else {
                        setSelectedFiles([]);
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modified
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentPath && (
                <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => navigateToFolder('..')}>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FolderIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <span className="text-sm font-medium text-gray-900">..</span>
                    </div>
                  </td>
                  <td colSpan="4"></td>
                </tr>
              )}
              {files.map((file) => (
                <tr key={file.path} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedFiles.some(f => f.path === file.path)}
                      onChange={() => handleFileSelect(file)}
                      className="rounded border-gray-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                    onDoubleClick={() => {
                      if (file.type === 'directory') {
                        navigateToFolder(file.path);
                      } else if (isTextFile(file.name)) {
                        handleEdit(file);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      {file.type === 'directory' ? (
                        <FolderIcon className="h-5 w-5 text-yellow-500 mr-3" />
                      ) : (
                        <DocumentIcon className="h-5 w-5 text-gray-400 mr-3" />
                      )}
                      <span className="text-sm font-medium text-gray-900">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {file.type === 'directory' ? '-' : formatFileSize(file.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    {file.permissions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(file.modified)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      {file.type === 'file' && isTextFile(file.name) && (
                        <>
                          <button
                            onClick={() => handleAskAI(file)}
                            className="text-violet-600 hover:text-violet-900"
                            title="Ask AI"
                          >
                            <SparklesIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(file)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {file.type === 'file' && (
                        <button
                          onClick={() => handleDownload(file)}
                          className="text-green-600 hover:text-green-900"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
                      )}
                      {file.type === 'file' && isArchive(file.name) && (
                        <button
                          onClick={() => handleExtract(file)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Extract"
                        >
                          <ArchiveBoxIcon className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(file)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {files.length === 0 && !currentPath && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500">
                    This directory is empty
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowUploadModal(false)}></div>
            <div className="relative bg-white rounded-lg px-4 pt-5 pb-4 shadow-xl max-w-lg w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Files</h3>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100"
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Directory Modal */}
      {showMkdirModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowMkdirModal(false)}></div>
            <div className="relative bg-white rounded-lg px-4 pt-5 pb-4 shadow-xl max-w-lg w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Directory</h3>
              <input
                type="text"
                value={newDirName}
                onChange={(e) => setNewDirName(e.target.value)}
                placeholder="Directory name"
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowMkdirModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDirectory}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Editor Modal */}
      {showEditorModal && editingFile && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowEditorModal(false)}></div>
            <div className="relative bg-white rounded-lg px-4 pt-5 pb-4 shadow-xl max-w-4xl w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Editing: {editingFile.name}
              </h3>
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className="block w-full h-96 border border-gray-300 rounded-md shadow-sm py-2 px-3 font-mono text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditorModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFile}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Save File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowPermissionsModal(false)}></div>
            <div className="relative bg-white rounded-lg px-4 pt-5 pb-4 shadow-xl max-w-lg w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Change Permissions</h3>
              <p className="text-sm text-gray-600 mb-4">
                Setting permissions for {selectedFiles.length} file(s)
              </p>
              <input
                type="text"
                value={permissions}
                onChange={(e) => setPermissions(e.target.value)}
                placeholder="755"
                maxLength="3"
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 font-mono focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-2 text-xs text-gray-500">
                Common values: 644 (rw-r--r--), 755 (rwxr-xr-x), 777 (rwxrwxrwx)
              </p>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePermissions}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ask AI Modal */}
      {showAiModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAiModal(false)}></div>
            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="h-6 w-6 text-violet-600" />
                  <h3 className="text-xl font-bold text-gray-900">Ask AI about {selectedAiFile?.name}</h3>
                </div>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question (optional)
                  </label>
                  <textarea
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="What does this file do? How can I improve it?"
                    rows={3}
                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Leave empty for general file explanation</p>
                </div>
                
                <button
                  onClick={handleAiSubmit}
                  disabled={aiLoading}
                  className="w-full mb-4 px-4 py-2 bg-violet-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {aiLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Thinking...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-5 w-5" />
                      Ask AI
                    </>
                  )}
                </button>
                
                {aiResponse && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">AI Response:</h4>
                    <pre className="whitespace-pre-wrap text-sm text-gray-700">
                      {aiResponse}
                    </pre>
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t flex justify-end">
                <button
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

