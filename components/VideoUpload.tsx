'use client';

import React, { useState, useRef } from 'react';

interface VideoUploadProps {
 onUploadSuccess: (fileData: {
 publicId: string;
 url: string;
 originalFilename: string;
 fileSize: number;
 duration: number;
 format: string;
 }) => void;
 onUploadError: (error: string) => void;
 disabled?: boolean;
 currentFile?: {
 url: string;
 filename: string;
 } | null;
}

export default function VideoUpload({ 
 onUploadSuccess, 
 onUploadError, 
 disabled = false,
 currentFile = null 
}: VideoUploadProps) {
 const [isUploading, setIsUploading] = useState(false);
 const [uploadProgress, setUploadProgress] = useState(0);
 const [dragActive, setDragActive] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const handleFileUpload = async (file: File) => {
 if (!file) return;

 // Validate file type - check both MIME type and file extension for better browser compatibility
 const allowedTypes = [
 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi', 
 'video/x-ms-wmv', 'video/webm', 'video/x-flv', 'video/3gpp',
 'video/x-m4v', 'video/m4v', '' // Some browsers don't provide MIME type
 ];
 
 const fileExtension = file.name.toLowerCase().split('.').pop();
 const allowedExtensions = ['mp4', 'mov', 'avi', 'wmv', 'webm', 'flv', 'm4v', '3gp'];
 
 const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension || '');
 
 if (!isValidType) {
 onUploadError('Invalid file type. Please upload video files with extensions: MP4, MOV, AVI, WMV, WebM, FLV, or M4V.');
 return;
 }

 // Validate file size (100MB for videos)
 if (file.size > 100000000) {
 onUploadError('File too large. Maximum size is 100MB.');
 return;
 }

 setIsUploading(true);
 setUploadProgress(0);

 try {
 // Step 1: Get signature from our endpoint
 const signatureResponse = await fetch('/api/upload/video', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 filename: file.name,
 fileSize: file.size
 }),
 });

 if (!signatureResponse.ok) {
 throw new Error(`Signature error: ${signatureResponse.status}`);
 }

 const signatureData = await signatureResponse.json();
 
 if (!signatureData.success) {
 throw new Error(signatureData.error || 'Failed to get upload signature');
 }

 console.log(' Video signature data received:', signatureData.data);
 setUploadProgress(10);

 // Step 2: Upload directly to Cloudinary
 const formData = new FormData();
 formData.append('file', file);
 formData.append('api_key', signatureData.data.api_key);
 formData.append('timestamp', signatureData.data.timestamp.toString());
 formData.append('signature', signatureData.data.signature);
 formData.append('public_id', signatureData.data.public_id);

 const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signatureData.data.cloud_name}/${signatureData.data.resource_type}/upload`;
 console.log(' Uploading video to:', cloudinaryUrl);
 console.log('📤 Form data keys:', Array.from(formData.keys()));

 // Create XMLHttpRequest for progress tracking
 const uploadPromise = new Promise((resolve, reject) => {
 const xhr = new XMLHttpRequest();
 
 xhr.upload.addEventListener('progress', (e) => {
 if (e.lengthComputable) {
 const progress = 10 + Math.round((e.loaded / e.total) * 80); // 10-90%
 setUploadProgress(progress);
 }
 });

 xhr.addEventListener('load', () => {
 if (xhr.status === 200) {
 try {
 const result = JSON.parse(xhr.responseText);
 resolve(result);
 } catch (e) {
 reject(new Error('Invalid response from Cloudinary'));
 }
 } else {
 reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
 }
 });

 xhr.addEventListener('error', () => {
 reject(new Error('Network error during upload'));
 });

 xhr.open('POST', cloudinaryUrl);
 xhr.send(formData);
 });

 const cloudinaryResult = await uploadPromise as any;
 setUploadProgress(95);

 // Step 3: Format response to match expected structure
 const result = {
 publicId: cloudinaryResult.public_id,
 url: cloudinaryResult.secure_url,
 originalFilename: file.name,
 fileSize: file.size,
 duration: cloudinaryResult.duration, // Duration in seconds
 format: cloudinaryResult.format,
 resourceType: cloudinaryResult.resource_type,
 createdAt: cloudinaryResult.created_at
 };

 onUploadSuccess(result);
 setUploadProgress(100);

 } catch (error: any) {
 console.error('Video upload error:', error);
 
 if (error.message?.includes('Network error')) {
 onUploadError('Network error. Please check your internet connection and try again.');
 } else if (error.message?.includes('Signature error')) {
 onUploadError('Upload validation failed. Please try again.');
 } else if (error.message?.includes('Upload failed')) {
 onUploadError(`Upload failed: ${error.message}`);
 } else {
 onUploadError('Upload failed. Please try again.');
 }
 } finally {
 setIsUploading(false);
 setTimeout(() => setUploadProgress(0), 2000);
 }
 };

 const handleDrop = (e: React.DragEvent) => {
 e.preventDefault();
 setDragActive(false);

 if (disabled || isUploading) return;

 const files = e.dataTransfer.files;
 if (files.length > 0) {
 handleFileUpload(files[0]);
 }
 };

 const handleDragOver = (e: React.DragEvent) => {
 e.preventDefault();
 if (!disabled && !isUploading) {
 setDragActive(true);
 }
 };

 const handleDragLeave = (e: React.DragEvent) => {
 e.preventDefault();
 setDragActive(false);
 };

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (files && files.length > 0) {
 handleFileUpload(files[0]);
 }
 };

 const formatFileSize = (bytes: number) => {
 if (bytes === 0) return '0 Bytes';
 const k = 1024;
 const sizes = ['Bytes', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
 };

 const formatDuration = (seconds: number) => {
 const mins = Math.floor(seconds / 60);
 const secs = Math.floor(seconds % 60);
 return `${mins}:${secs.toString().padStart(2, '0')}`;
 };

 return (
 <div className="space-y-4"> {/* Current File Display */}
 {currentFile && (
 <div className="bg-green-900/30 border border-green-500/40 rounded-xl p-4 sm:p-6 backdrop-blur-sm">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
 <div className="flex items-center space-x-3">
 <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center border border-[rgba(192,192,192,0.22)]">
 <span className="text-2xl"></span>
 </div>
 <div>
 <p className="font-semibold text-green-300 text-base"> Video File Uploaded</p>
 <p className="text-sm text-green-200 break-all">{currentFile.filename}</p>
 </div>
 </div>
 <div className="flex justify-center sm:justify-end">
 <video 
 controls 
 className="h-24 sm:h-20 rounded-lg bg-slate-800/60 max-w-full" style={{ 
 width: 'auto', 
 maxWidth: '280px',
 minWidth: '200px'
 }}
 preload="metadata" >
 <source src={currentFile.url} type="video/mp4" />
 <source src={currentFile.url} type="video/webm" /> Your browser does not support the video element.
 </video>
 </div>
 </div>
 </div> )}

 {/* Upload Area */}
 <div
 className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 transition-all duration-300 transform hover:scale-[1.01] ${
 dragActive
 ? 'border-purple-400 bg-purple-500/10 scale-[1.02]'
 : disabled
 ? 'border-slate-600 bg-slate-700/20 opacity-60 cursor-not-allowed'
 : isUploading
 ? 'border-blue-400 bg-blue-500/10'
 : 'border-slate-500 bg-slate-700/30 hover:border-purple-400 hover:bg-purple-500/10'
 }`}
 onDrop={handleDrop}
 onDragOver={handleDragOver}
 onDragLeave={handleDragLeave}
 > {isUploading ? (
 <div className="text-center py-4">
 <div className="w-16 h-16 mx-auto mb-6 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
 <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-400 border-t-transparent"></div>
 </div>
 <h4 className="text-lg font-semibold text-blue-300 mb-2">Uploading Video...</h4>
 <div className="mt-4 w-full bg-slate-600/50 rounded-full h-3 border border-slate-500/50">
 <div 
 className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out" style={{ width: `${uploadProgress}%` }}
 ></div>
 </div>
 <p className="text-sm text-blue-200 mt-3 font-medium">{uploadProgress}% complete</p>
 </div> ) : (
 <div className="text-center py-4">
 <div className={`w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
 dragActive 
 ? 'bg-[rgba(192,192,192,0.08)] border-purple-400 scale-110' 
 : disabled
 ? 'bg-slate-600/20 border-slate-500'
 : 'bg-slate-600/30 border-slate-500 hover:border-purple-400 hover:bg-[rgba(192,192,192,0.08)]'
 }`}>
 <span className="text-3xl">{dragActive ? '' : ''}</span>
 </div>  <h4 className={`text-lg font-semibold mb-2 ${
 disabled ? 'text-slate-400' : 'text-slate-200'
 }`}> {currentFile ? '🔄 Replace Video File' : '📤 Upload Video File'}</h4>  <p className={`text-sm mb-2 ${
 disabled ? 'text-slate-500' : 'text-slate-300'
 }`}> {dragActive 
 ? ' Drop your video file here!' 
 : 'Drag and drop or click to select your video file'
 }
 </p>  <div className={`text-xs mb-4 space-y-1 ${
 disabled ? 'text-slate-500' : 'text-slate-400'
 }`}>
 <p> <strong>Supports:</strong> MP4, MOV, AVI, WMV, WebM</p>
 <p>📏 <strong>Max size:</strong> 100MB</p>
 <p>⏱️ <strong>Recommended:</strong> 2-5 minute duration</p>
 </div>  <button
 type="button" onClick={() => fileInputRef.current?.click()}
 disabled={disabled}
 className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 transform ${
 disabled
 ? 'bg-slate-600/50 text-slate-400 cursor-not-allowed border border-slate-500/50'
 : 'btn-chrome !rounded-full text-white hover:scale-105 shadow-lg hover:shadow-[0_0_24px_rgba(192,192,192,0.18)] border border-[rgba(192,192,192,0.22)]'
 }`}
 > {currentFile ? '🔄 Choose New File' : '📁 Choose File'}
 </button>
 </div> )}

 <input
 ref={fileInputRef}
 type="file" accept=".mp4,.mov,.avi,.wmv,.webm,.flv,.m4v,video/*" onChange={handleFileSelect}
 className="hidden" disabled={disabled || isUploading}
 />
 </div> {/* Enhanced Help Text */}
 <div className="bg-slate-800/40 border border-slate-600/50 rounded-lg p-4 space-y-2">
 <h5 className="text-sm font-semibold text-slate-300 mb-3 flex items-center">
 <span className="mr-2"></span> Video Upload Guidelines</h5>
 <div className="text-xs text-slate-400 space-y-1.5">
 <p className="flex items-start">
 <span className="mr-2 text-[var(--chrome-mid)]"></span>
 <span>Video will be used for virtual performance evaluation</span>
 </p>
 <p className="flex items-start">
 <span className="mr-2 text-blue-400">👀</span>
 <span>Judges can view and assess your virtual performance</span>
 </p>
 <p className="flex items-start">
 <span className="mr-2 text-yellow-400"></span>
 <span>Ensure this is your <strong>final performance video</strong></span>
 </p>
 <p className="flex items-start">
 <span className="mr-2 text-[var(--chrome-mid)]"></span>
 <span>High-quality videos provide better viewing experience for judges</span>
 </p>
 </div>
 </div>
 </div> );
}
