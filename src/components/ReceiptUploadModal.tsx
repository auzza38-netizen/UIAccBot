import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  Camera,
  Upload,
  Folder,
  FolderOpen,
  FolderUp,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Check,
  X,
  FileText,
  RotateCcw,
  Plus,
  Trash2,
  Lock,
  Eye,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Layers,
  Edit3,
  AlertCircle,
  FileSpreadsheet,
  Split,
  BookOpen,
  FolderTree,
  FolderPlus,
  CornerDownRight,
  FileStack,
  LayoutGrid,
  List,
  Images,
  HelpCircle,
  Maximize2,
} from 'lucide-react';
import { Project, ExpenseCategory, Receipt, ReceiptItem, PDFPageBreakdown } from '../types';
import { formatCurrency, formatThaiDate, computeBase64Hash } from '../utils/formatters';
import { checkDuplicateReceipt } from '../services/dbService';
import { runMockReceiptOcr } from '../services/mockOcrService';

export interface BatchReceiptItem {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isPdf: boolean;
  base64: string;
  hash: string;
  status: 'pending' | 'processing' | 'completed' | 'needs_review' | 'failed' | 'duplicate';
  duplicateReason?: string;
  errorMessage?: string;
  extracted?: {
    documentType: Receipt['documentType'];
    documentDate: string;
    receiptNumber: string;
    vendorName: string;
    vendorTaxId: string;
    vendorAddress?: string;
    customerName?: string;
    customerTaxId?: string;
    customerAddress?: string;
    subtotal: number | '';
    vatAmount: number | '';
    withholdingTax: number | '';
    discount: number | '';
    grandTotal: number | '';
    currency: string;
    paymentMethod: string;
    categoryId: string;
    items: ReceiptItem[];
    ocrNotes: string;
    totalPagesRead?: number;
    pdfPages?: PDFPageBreakdown[];
    needsReview: boolean;
    reviewReasons: string[];
    modelUsed?: string;
  };
  projectId: string;
  categoryId: string;
  savedReceiptId?: string;
}

interface ReceiptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (receiptId: string) => void;
}

export const ReceiptUploadModal: React.FC<ReceiptUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { projects, categories, receipts, saveReceipt, saveCategory } = useData();
  const { currentUser, isAdmin } = useAuth();

  // Confidential document mode disabled - all documents are processed with AI OCR
  const isConfidential = false;

  // Steps: 1: Select Project & Category, 2: Upload Image, 3: Review & Edit
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Quick Add Category Modal state (supports Main Category and Sub-Category)
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState<boolean>(false);
  const [catAddMode, setCatAddMode] = useState<'main' | 'sub'>('main');
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatParentId, setNewCatParentId] = useState<string>('');
  const [isSavingCat, setIsSavingCat] = useState<boolean>(false);

  // Grouped Categories
  const mainCategories = categories.filter((c) => c.level === 'main' || !c.parentId);
  const getSubcategories = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId && c.level === 'sub');

  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    if (catAddMode === 'sub' && !newCatParentId) {
      alert('กรุณาเลือกหมวดหมู่หลักที่ต้องการผูกหมวดหมู่ย่อยนี้');
      return;
    }

    setIsSavingCat(true);
    try {
      const newCatId = 'cat-' + Date.now();
      await saveCategory(
        newCatName.trim(),
        newCatId,
        catAddMode === 'sub' ? newCatParentId : null,
        catAddMode
      );
      setCategoryId(newCatId);
      setNewCatName('');
      setIsAddCatModalOpen(false);
    } catch (err: any) {
      alert('เพิ่มหมวดหมู่ไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSavingCat(false);
    }
  };

  // Form Fields (Single Mode)
  const [projectId, setProjectId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('cat-other');
  const [documentType, setDocumentType] = useState<Receipt['documentType']>('receipt');
  const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');
  const [vendorTaxId, setVendorTaxId] = useState<string>('');
  const [vendorAddress, setVendorAddress] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerTaxId, setCustomerTaxId] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [subtotal, setSubtotal] = useState<number | ''>('');
  const [vatAmount, setVatAmount] = useState<number | ''>('');
  const [withholdingTax, setWithholdingTax] = useState<number | ''>('');
  const [discount, setDiscount] = useState<number | ''>('');
  const [grandTotal, setGrandTotal] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('เงินสด');
  const [currency, setCurrency] = useState<string>('THB');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [totalPagesRead, setTotalPagesRead] = useState<number>(1);
  const [pdfPages, setPdfPages] = useState<PDFPageBreakdown[]>([]);
  const [selectedPageFilter, setSelectedPageFilter] = useState<number | 'all'>('all');

  // Image & OCR State (Single Mode)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageHash, setImageHash] = useState<string>('');
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState<boolean>(false);
  const [reviewReasons, setReviewReasons] = useState<string[]>([]);
  const [ocrNotes, setOcrNotes] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('ui-template-mock-ocr');
  const [fallbackTriggered, setFallbackTriggered] = useState<boolean>(false);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Batch Mode States
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [batchItems, setBatchItems] = useState<BatchReceiptItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentFileName: string }>({
    current: 0,
    total: 0,
    currentFileName: '',
  });
  const [editingBatchItemIndex, setEditingBatchItemIndex] = useState<number | null>(null);
  const [batchSaveSuccessMessage, setBatchSaveSuccessMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [batchViewMode, setBatchViewMode] = useState<'gallery' | 'table'>('gallery');
  const [zoomPreviewUrl, setZoomPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Preselect first active project if available
  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].projectId);
    }
  }, [projects, projectId]);

  if (!isOpen) return null;

  // Reset form
  const handleReset = () => {
    setCurrentStep(1);
    setImageFile(null);
    setImageBase64('');
    setImageHash('');
    setOcrError(null);
    setNeedsReview(false);
    setReviewReasons([]);
    setOcrNotes('');
    setDuplicateWarning(null);
    setReceiptNumber('');
    setVendorName('');
    setVendorTaxId('');
    setVendorAddress('');
    setCustomerName('');
    setCustomerTaxId('');
    setCustomerAddress('');
    setSubtotal('');
    setVatAmount('');
    setWithholdingTax('');
    setDiscount('');
    setGrandTotal('');
    setItems([]);
    setNotes('');
    setTotalPagesRead(1);
    setPdfPages([]);
    setSelectedPageFilter('all');

    // Reset batch state
    setIsBatchMode(false);
    setBatchItems([]);
    setIsBatchProcessing(false);
    setEditingBatchItemIndex(null);
    setBatchSaveSuccessMessage(null);
    setZoomPreviewUrl(null);
  };

  // Helper to extract files recursively from dropped folders or multi-file drops
  const getFilesFromDataTransfer = async (dataTransfer: DataTransfer): Promise<File[]> => {
    const files: File[] = [];
    const items = dataTransfer.items;
    if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      const traverse = async (entry: any) => {
        if (!entry) return;
        if (entry.isFile) {
          try {
            const file: File = await new Promise((res, rej) => entry.file(res, rej));
            files.push(file);
          } catch {}
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          const readEntries = async (): Promise<any[]> => {
            return new Promise((res, rej) => dirReader.readEntries(res, rej));
          };
          try {
            let entries = await readEntries();
            while (entries.length > 0) {
              for (const child of entries) {
                await traverse(child);
              }
              entries = await readEntries();
            }
          } catch {}
        }
      };

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) {
          await traverse(entry);
        }
      }
    } else if (dataTransfer.files) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        files.push(dataTransfer.files[i]);
      }
    }
    return files;
  };

  // Convert File to base64 helper
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Optimize image size to prevent excessive payload and speed up AI extraction
  const optimizeImageForOcr = async (file: File): Promise<string> => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return readFileAsBase64(file);
    }

    if (file.size < 1.5 * 1024 * 1024) {
      return readFileAsBase64(file);
    }

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 2048;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        } else {
          readFileAsBase64(file).then(resolve);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        readFileAsBase64(file).then(resolve);
      };
      img.src = url;
    });
  };

  // Filter valid receipt images and PDFs
  const filterValidFiles = (files: File[]): File[] => {
    return files.filter((f) => {
      const type = f.type.toLowerCase();
      const name = f.name.toLowerCase();
      return (
        type.startsWith('image/') ||
        type === 'application/pdf' ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.webp') ||
        name.endsWith('.pdf')
      );
    });
  };

  // Handle single file setup
  const handleSingleFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      setOcrError('ไฟล์มีขนาดใหญ่เกิน 25MB กรุณาเลือกไฟล์ขนาดเล็กลง');
      return;
    }

    setImageFile(file);
    try {
      const base64 = await optimizeImageForOcr(file);
      setImageBase64(base64);

      const hash = await computeBase64Hash(base64);
      setImageHash(hash);

      setCurrentStep(3); // Go to review

      // Always perform AI OCR extraction
      await runAiOcr(base64, file.type, hash);
    } catch (err: any) {
      setOcrError('ไม่สามารถอ่านไฟล์ได้: ' + err.message);
    }
  };

  // Handle batch files or folder selection
  const handleBatchFiles = async (files: File[]) => {
    const valid = filterValidFiles(files);
    if (valid.length === 0) {
      setOcrError('ไม่พบไฟล์รูปภาพ (JPG, PNG, WebP) หรือไฟล์ PDF ในโฟลเดอร์/สิ่งที่เลือก');
      return;
    }

    if (valid.length === 1 && !isBatchMode) {
      // Exactly 1 file selected, process as single
      await handleSingleFile(valid[0]);
      return;
    }

    // Switch to Batch Mode
    setIsBatchMode(true);
    setBatchSaveSuccessMessage(null);

    const newItems: BatchReceiptItem[] = [];
    for (let i = 0; i < valid.length; i++) {
      const f = valid[i];
      try {
        const b64 = await optimizeImageForOcr(f);
        const h = await computeBase64Hash(b64);
        newItems.push({
          id: 'batch_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 5),
          file: f,
          fileName: f.name,
          fileSize: f.size,
          mimeType: f.type || (f.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          isPdf: f.type.includes('pdf') || f.name.endsWith('.pdf'),
          base64: b64,
          hash: h,
          status: 'pending',
          projectId: projectId || (projects[0]?.projectId || ''),
          categoryId: categoryId || 'cat-other',
        });
      } catch (err) {
        console.error('Failed reading file in batch:', f.name, err);
      }
    }

    setBatchItems((prev) => [...prev, ...newItems]);
  };

  // Multi-file / Folder file input listener
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    await handleBatchFiles(files);
    // Reset file input value so re-selecting same folder works
    e.target.value = '';
  };

  // Drag and drop handlers for folders or files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (!projectId) {
      alert('กรุณาเลือกโครงการก่อนวางไฟล์');
      return;
    }
    const dt = e.dataTransfer;
    if (!dt) return;
    const files = await getFilesFromDataTransfer(dt);
    if (files.length > 0) {
      await handleBatchFiles(files);
    }
  };

  // Run Simulated OCR (Single Mode)
  const runAiOcr = async (_base64: string, mimeType: string, hash: string) => {
    setIsProcessingAI(true);
    setOcrError(null);
    setReviewReasons([]);

    try {
      const result = await runMockReceiptOcr({
        fileName: imageFile?.name,
        mimeType,
        categoryNames: categories.map((c) => c.categoryName),
      });

      if (!result || !result.success) {
        throw new Error('OCR processing failed');
      }

      if (result.modelUsed) setModelUsed(result.modelUsed);
      if (result.fallbackTriggered !== undefined) setFallbackTriggered(result.fallbackTriggered);
      if (result.executionTimeMs !== undefined) setExecutionTimeMs(result.executionTimeMs);

      const d = result.data;

      // Populate extracted fields
      if (d.documentType) setDocumentType(d.documentType);
      if (d.documentDate) setDocumentDate(d.documentDate);
      if (d.receiptNumber) setReceiptNumber(d.receiptNumber);
      if (d.vendorName) setVendorName(d.vendorName);
      if (d.vendorTaxId) setVendorTaxId(d.vendorTaxId);
      if (d.vendorAddress) setVendorAddress(d.vendorAddress);
      if (d.customerName) setCustomerName(d.customerName);
      if (d.customerTaxId) setCustomerTaxId(d.customerTaxId);
      if (d.customerAddress) setCustomerAddress(d.customerAddress);
      if (d.subtotal !== null && d.subtotal !== undefined) setSubtotal(d.subtotal);
      if (d.vatAmount !== null && d.vatAmount !== undefined) setVatAmount(d.vatAmount);
      if (d.withholdingTax !== null && d.withholdingTax !== undefined) setWithholdingTax(d.withholdingTax);
      if (d.discount !== null && d.discount !== undefined) setDiscount(d.discount);
      if (d.grandTotal !== null && d.grandTotal !== undefined) setGrandTotal(d.grandTotal);
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
      if (d.currency) setCurrency(d.currency);
      if (d.totalPagesRead) setTotalPagesRead(d.totalPagesRead);
      if (d.items && Array.isArray(d.items)) {
        setItems(
          d.items.map((it: any) => ({
            itemName: it.itemName || 'รายการ',
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || it.amount || 0,
            amount: it.amount || 0,
            pageNumber: it.pageNumber || 1,
          }))
        );
      }
      if (d.pages && Array.isArray(d.pages)) {
        setPdfPages(d.pages);
      }
      if (d.ocrNotes) setOcrNotes(d.ocrNotes);
      if (d.needsReview) {
        setNeedsReview(true);
        setReviewReasons(d.reviewReasons || ['ข้อมูลอาจไม่สมบูรณ์หรือตัวเลขไม่ตรงกัน']);
      }

      // Match suggested category
      if (d.suggestedCategory) {
        const found = categories.find((c) => c.categoryName.includes(d.suggestedCategory));
        if (found) setCategoryId(found.categoryId);
      }

      // Check duplicates with extracted info
      await checkForDuplicates(
        hash,
        d.vendorName || '',
        d.documentDate || '',
        d.receiptNumber || '',
        d.grandTotal || 0
      );
    } catch (err: any) {
      console.error('OCR Error:', err);
      setOcrError(err.message || 'ไม่สามารถประมวลผลด้วย AI ได้ กรุณากรอกข้อมูลด้วยตนเอง');
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Execute OCR for an individual batch item
  const processBatchItemOCR = async (item: BatchReceiptItem): Promise<BatchReceiptItem> => {
    try {
      const result = await runMockReceiptOcr({
        fileName: item.fileName,
        mimeType: item.mimeType,
        categoryNames: categories.map((c) => c.categoryName),
      });

      if (!result || !result.success) {
        return {
          ...item,
          status: 'failed',
          errorMessage: 'ประมวลผลไม่สำเร็จ',
        };
      }

      const d = result.data;
      let matchedCategory = item.categoryId;
      if (d.suggestedCategory) {
        const found = categories.find((c) => c.categoryName.includes(d.suggestedCategory));
        if (found) matchedCategory = found.categoryId;
      }

      // Check duplicates against in-memory receipts
      const dupCheck = await checkDuplicateReceipt(
        null,
        d.vendorName || '',
        d.documentDate || '',
        d.receiptNumber || '',
        d.grandTotal || 0,
        item.hash,
        receipts
      );

      const status: BatchReceiptItem['status'] = dupCheck.isDuplicate
        ? 'duplicate'
        : d.needsReview
        ? 'needs_review'
        : 'completed';

      return {
        ...item,
        status,
        duplicateReason: dupCheck.reason,
        extracted: {
          documentType: d.documentType || 'receipt',
          documentDate: d.documentDate || new Date().toISOString().slice(0, 10),
          receiptNumber: d.receiptNumber || '',
          vendorName: d.vendorName || 'ไม่ระบุชื่อร้าน',
          vendorTaxId: d.vendorTaxId || '',
          vendorAddress: d.vendorAddress || '',
          customerName: d.customerName || '',
          customerTaxId: d.customerTaxId || '',
          customerAddress: d.customerAddress || '',
          subtotal: d.subtotal !== null && d.subtotal !== undefined ? d.subtotal : '',
          vatAmount: d.vatAmount !== null && d.vatAmount !== undefined ? d.vatAmount : '',
          withholdingTax: d.withholdingTax !== null && d.withholdingTax !== undefined ? d.withholdingTax : '',
          discount: d.discount !== null && d.discount !== undefined ? d.discount : '',
          grandTotal: d.grandTotal !== null && d.grandTotal !== undefined ? d.grandTotal : 0,
          currency: d.currency || 'THB',
          paymentMethod: d.paymentMethod || 'เงินสด',
          categoryId: matchedCategory,
          items: d.items || [],
          ocrNotes: d.ocrNotes || '',
          totalPagesRead: d.totalPagesRead || 1,
          pdfPages: d.pages || [],
          needsReview: Boolean(d.needsReview),
          reviewReasons: d.reviewReasons || [],
          modelUsed: result.modelUsed,
        },
      };
    } catch (err: any) {
      return {
        ...item,
        status: 'failed',
        errorMessage: err.message || 'ข้อผิดพลาดเครือข่าย',
      };
    }
  };

  // Run Batch OCR across all pending/failed items or a specific item
  const startBatchOCR = async (retryOnlyId?: string) => {
    if (batchItems.length === 0 || isBatchProcessing) return;
    setIsBatchProcessing(true);

    const itemsToProcess = retryOnlyId
      ? batchItems.filter((it) => it.id === retryOnlyId)
      : batchItems.filter((it) => it.status === 'pending' || it.status === 'failed');

    if (itemsToProcess.length === 0) {
      setIsBatchProcessing(false);
      return;
    }

    let processedCount = 0;

    for (const item of itemsToProcess) {
      setBatchProgress({
        current: processedCount + 1,
        total: itemsToProcess.length,
        currentFileName: item.fileName,
      });

      // Update item state to 'processing'
      setBatchItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'processing', errorMessage: undefined } : it))
      );

      // Process with OCR
      const updatedItem = await processBatchItemOCR(item);

      // Update state with result
      setBatchItems((prev) =>
        prev.map((it) => (it.id === item.id ? updatedItem : it))
      );

      processedCount++;

      // Small throttle pause between multiple items to respect API rate limits
      if (processedCount < itemsToProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    setIsBatchProcessing(false);
  };

  // Save all completed/reviewed receipts from batch
  const saveAllBatchItems = async () => {
    const readyItems = batchItems.filter(
      (it) => (it.status === 'completed' || it.status === 'needs_review' || it.status === 'duplicate') && !it.savedReceiptId
    );

    if (readyItems.length === 0) {
      alert('ไม่มีรายการที่พร้อมบันทึก (กรุณารอหรือตรวจสอบผลการอ่าน AI ก่อน)');
      return;
    }

    setIsSaving(true);
    let savedCount = 0;
    let firstSavedId: string = '';

    try {
      const savedMap: Record<string, string> = {};

      for (const item of readyItems) {
        const ext = item.extracted;
        const finalGrandTotal = Number(ext?.grandTotal || 0);

        const receiptData: Partial<Receipt> = {
          projectId: item.projectId || projectId || (projects[0]?.projectId || ''),
          categoryId: ext?.categoryId || item.categoryId || 'cat-other',
          documentType: ext?.documentType || 'receipt',
          documentDate: ext?.documentDate || new Date().toISOString().slice(0, 10),
          receiptNumber: ext?.receiptNumber || '',
          vendorName: ext?.vendorName || item.fileName,
          vendorTaxId: ext?.vendorTaxId || '',
          vendorAddress: ext?.vendorAddress || '',
          customerName: ext?.customerName || '',
          customerTaxId: ext?.customerTaxId || '',
          customerAddress: ext?.customerAddress || '',
          subtotal: Number(ext?.subtotal) || 0,
          vatAmount: Number(ext?.vatAmount) || 0,
          withholdingTax: Number(ext?.withholdingTax) || 0,
          discount: Number(ext?.discount) || 0,
          grandTotal: finalGrandTotal,
          currency: ext?.currency || 'THB',
          paymentMethod: ext?.paymentMethod || 'เงินสด',
          receiptImageUrl: item.base64,
          imageHash: item.hash,
          ocrStatus: isConfidential ? 'skipped' : ext ? 'completed' : 'failed',
          verificationStatus: ext?.needsReview ? 'needs_review' : 'verified',
          approvalStatus: 'pending',
          isConfidential,
          notes: ext?.ocrNotes || `นำเข้าจากโฟลเดอร์: ${item.fileName}`,
          items: ext?.items || [],
          totalPages: ext?.totalPagesRead || 1,
        };

        const newId = await saveReceipt(receiptData);
        if (!firstSavedId) firstSavedId = newId;
        savedMap[item.id] = newId;
        savedCount++;
      }

      // Batch update savedReceiptId for all saved items at once
      setBatchItems((prev) =>
        prev.map((it) => (savedMap[it.id] ? { ...it, savedReceiptId: savedMap[it.id] } : it))
      );

      setBatchSaveSuccessMessage(`บันทึกใบเสร็จเข้าสู่ระบบสำเร็จแล้วทั้งหมด ${savedCount} รายการ!`);
      if (firstSavedId) {
        onSuccess(firstSavedId);
      }
    } catch (err: any) {
      console.error('Batch save error:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกบางรายการ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Remove item from batch
  const removeBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Apply default project to all batch items
  const applyProjectToAllBatch = (newProjId: string) => {
    setProjectId(newProjId);
    setBatchItems((prev) => prev.map((it) => ({ ...it, projectId: newProjId })));
  };

  // Check duplicate receipt in memory (Single Mode)
  const checkForDuplicates = async (
    hash: string,
    vName: string,
    dDate: string,
    rNum: string,
    gTotal: number
  ) => {
    const check = await checkDuplicateReceipt(null, vName, dDate, rNum, gTotal, hash, receipts);
    if (check.isDuplicate) {
      setDuplicateWarning(check.reason || 'ตรวจพบว่าอาจมีข้อมูลใบเสร็จนี้ในระบบแล้ว');
    } else {
      setDuplicateWarning(null);
    }
  };

  // Line item manipulation (Single Mode)
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        itemName: '',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        pageNumber: typeof selectedPageFilter === 'number' ? selectedPageFilter : 1,
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof ReceiptItem, val: any) => {
    const next = [...items];
    const item = { ...next[index], [field]: val };

    if (field === 'quantity' || field === 'unitPrice') {
      const q = field === 'quantity' ? Number(val) : item.quantity;
      const u = field === 'unitPrice' ? Number(val) : item.unitPrice;
      item.amount = Math.round(q * u * 100) / 100;
    }
    next[index] = item;
    setItems(next);

    const sum = next.reduce((acc, it) => acc + (it.amount || 0), 0);
    if (sum > 0) {
      setSubtotal(sum);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculate & Auto-balance totals (Single Mode)
  const calculatedGrandTotal =
    Number(subtotal || 0) + Number(vatAmount || 0) - Number(discount || 0) - Number(withholdingTax || 0);

  // Save handler (Single Mode)
  const handleSave = async (isDraft: boolean) => {
    if (!projectId) {
      alert('กรุณาเลือกโครงการสำหรับบันทึกค่าใช้จ่าย');
      return;
    }

    const finalGrandTotal = Number(grandTotal !== '' ? grandTotal : calculatedGrandTotal);
    if (isNaN(finalGrandTotal) || finalGrandTotal <= 0) {
      alert('กรุณากรอกยอดเงินสุทธิที่ถูกต้อง');
      return;
    }

    setIsSaving(true);
    try {
      const receiptData: Partial<Receipt> = {
        projectId,
        categoryId: categoryId || 'cat-other',
        documentType,
        documentDate: documentDate || new Date().toISOString().slice(0, 10),
        receiptNumber: receiptNumber.trim(),
        vendorName: vendorName.trim() || 'ไม่ระบุชื่อร้าน',
        vendorTaxId: vendorTaxId.trim(),
        vendorAddress: vendorAddress.trim(),
        customerName: customerName.trim(),
        customerTaxId: customerTaxId.trim(),
        customerAddress: customerAddress.trim(),
        subtotal: Number(subtotal) || 0,
        vatAmount: Number(vatAmount) || 0,
        withholdingTax: Number(withholdingTax) || 0,
        discount: Number(discount) || 0,
        grandTotal: finalGrandTotal,
        currency,
        paymentMethod,
        receiptImageUrl: imageBase64,
        imageHash,
        ocrStatus: isConfidential ? 'skipped' : ocrError ? 'failed' : 'completed',
        verificationStatus: isDraft ? 'draft' : needsReview ? 'needs_review' : 'verified',
        approvalStatus: isDraft ? 'draft' : 'pending',
        isConfidential,
        notes: notes.trim(),
        items: items.filter((it) => it.itemName.trim() !== ''),
        totalPages: totalPagesRead,
      };

      const newId = await saveReceipt(receiptData);
      onSuccess(newId);
      handleReset();
      onClose();
    } catch (err: any) {
      console.error('Error saving receipt:', err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'โปรดลองอีกครั้ง'));
    } finally {
      setIsSaving(false);
    }
  };

  // Split Multi-page PDF into separate receipts per page
  const handleSplitSavePdfPages = async () => {
    if (!projectId) {
      alert('กรุณาเลือกโครงการ');
      return;
    }

    const pagesToSplit: PDFPageBreakdown[] = pdfPages.length > 0
      ? pdfPages
      : Array.from({ length: totalPagesRead }, (_, i) => ({
          pageNumber: i + 1,
          items: items.filter((it) => (it.pageNumber || 1) === i + 1),
        }));

    if (pagesToSplit.length <= 1) {
      alert('เอกสารนี้มีเพียงหน้าเดียว ไม่จำเป็นต้องแยกหน้า');
      return;
    }

    if (!confirm(`ยืนยันการแยกบันทึกเอกสาร PDF นี้ออกเป็น ${pagesToSplit.length} ใบเสร็จตามแต่ละหน้าหรือไม่?`)) {
      return;
    }

    setIsSaving(true);
    let savedCount = 0;
    let firstId = '';

    try {
      for (const p of pagesToSplit) {
        const pageItems = items.filter((it) => (it.pageNumber || 1) === p.pageNumber);
        const pageSubtotal = p.subtotal || pageItems.reduce((sum, it) => sum + (it.amount || 0), 0);
        const pageVat = p.vatAmount || 0;
        const pageGrandTotal = p.grandTotal || (pageSubtotal + pageVat);
        const pageReceiptNumber = p.receiptNumber || (receiptNumber ? `${receiptNumber}-P${p.pageNumber}` : `P${p.pageNumber}`);

        const receiptData: Partial<Receipt> = {
          projectId,
          categoryId: categoryId || 'cat-other',
          documentType,
          documentDate: p.documentDate || documentDate || new Date().toISOString().slice(0, 10),
          receiptNumber: pageReceiptNumber,
          vendorName: p.vendorName || vendorName.trim() || 'ไม่ระบุชื่อร้าน',
          vendorTaxId: p.vendorTaxId || vendorTaxId.trim(),
          vendorAddress: p.vendorAddress || vendorAddress.trim(),
          customerName: p.customerName || customerName.trim(),
          customerTaxId: p.customerTaxId || customerTaxId.trim(),
          customerAddress: p.customerAddress || customerAddress.trim(),
          subtotal: pageSubtotal,
          vatAmount: pageVat,
          withholdingTax: 0,
          discount: 0,
          grandTotal: pageGrandTotal > 0 ? pageGrandTotal : ((Number(grandTotal) || 0) / pagesToSplit.length),
          currency,
          paymentMethod,
          receiptImageUrl: imageBase64,
          imageHash: `${imageHash}_p${p.pageNumber}`,
          ocrStatus: 'completed',
          verificationStatus: 'verified',
          approvalStatus: 'pending',
          isConfidential,
          notes: `[แยกจาก PDF หน้า ${p.pageNumber}/${pagesToSplit.length}] ${notes.trim()}`.trim(),
          items: pageItems.length > 0 ? pageItems : [{ itemName: `รายการตามใบเสร็จหน้าที่ ${p.pageNumber}`, quantity: 1, unitPrice: pageGrandTotal, amount: pageGrandTotal, pageNumber: p.pageNumber }],
          totalPages: 1,
        };

        const newId = await saveReceipt(receiptData);
        if (!firstId) firstId = newId;
        savedCount++;
      }

      alert(`แยกและบันทึกใบเสร็จสำเร็จทั้งหมด ${savedCount} รายการ (แยกตามแต่ละหน้าของ PDF)!`);
      if (firstId) onSuccess(firstId);
      handleReset();
      onClose();
    } catch (err: any) {
      console.error('Error splitting PDF pages:', err);
      alert('เกิดข้อผิดพลาดในการแยกบันทึก: ' + (err.message || 'โปรดลองอีกครั้ง'));
    } finally {
      setIsSaving(false);
    }
  };

  const isCurrentFilePdf = imageFile?.type === 'application/pdf' || imageBase64.startsWith('data:application/pdf');

  // Stats for Batch
  const batchTotalAmount = batchItems.reduce((acc, it) => acc + (Number(it.extracted?.grandTotal) || 0), 0);
  const batchReadyCount = batchItems.filter((it) => (it.status === 'completed' || it.status === 'needs_review' || it.status === 'duplicate') && !it.savedReceiptId).length;
  const batchCompletedCount = batchItems.filter((it) => it.status === 'completed' || it.status === 'needs_review' || it.status === 'duplicate').length;
  const batchPendingCount = batchItems.filter((it) => it.status === 'pending').length;
  const batchFailedCount = batchItems.filter((it) => it.status === 'failed').length;
  const batchSavedCount = batchItems.filter((it) => Boolean(it.savedReceiptId)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl my-auto border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#12304A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#0D9488] text-white">
              {isBatchMode ? <FolderOpen className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight flex items-center gap-2">
                <span>{isBatchMode ? 'นำเข้าใบเสร็จเป็นชุด / ทั้งโฟลเดอร์ (Batch Folder Import)' : 'บันทึกใบเสร็จรับเงิน & ค่าใช้จ่าย'}</span>
                {isBatchMode && (
                  <span className="bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {batchItems.length} ไฟล์
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-teal-200/90">
                ✨ โหมด AI Assisted OCR Simulator (จำลองการสกัดข้อมูลและรองรับ Multi-Page PDF)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          
          {/* ============================================================== */}
          {/* BATCH MODE VIEW                                               */}
          {/* ============================================================== */}
          {isBatchMode ? (
            <div className="space-y-5">
              
              {/* Batch Success Notification */}
              {batchSaveSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-bold">{batchSaveSuccessMessage}</span>
                  </div>
                  <button
                    onClick={() => {
                      handleReset();
                      onClose();
                    }}
                    className="px-3 py-1 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 cursor-pointer text-xs"
                  >
                    เสร็จสิ้น
                  </button>
                </div>
              )}

              {/* KPI Strip for Batch */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-slate-500 block text-[11px]">เอกสารในชุดนี้</span>
                  <span className="text-lg font-bold text-slate-900 font-mono">{batchItems.length}</span>
                  <span className="text-[10px] text-slate-400 ml-1">ไฟล์</span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <span className="text-emerald-700 block text-[11px] font-medium">อ่านข้อมูลสำเร็จ</span>
                  <span className="text-lg font-bold text-emerald-800 font-mono">{batchCompletedCount}</span>
                  <span className="text-[10px] text-emerald-600 ml-1">/ {batchItems.length}</span>
                </div>

                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                  <span className="text-teal-700 block text-[11px] font-medium">ยอดรวมสุทธิทั้งชุด</span>
                  <span className="text-lg font-bold text-teal-800 font-mono">฿{formatCurrency(batchTotalAmount)}</span>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <span className="text-blue-700 block text-[11px] font-medium">บันทึกเรียบร้อย</span>
                  <span className="text-lg font-bold text-blue-800 font-mono">{batchSavedCount}</span>
                  <span className="text-[10px] text-blue-600 ml-1">รายการ</span>
                </div>
              </div>

              {/* Batch Settings & Action Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      โครงการเป้าหมาย (กำหนดให้ทุกไฟล์ในชุด)
                    </label>
                    <select
                      value={projectId}
                      onChange={(e) => applyProjectToAllBatch(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium"
                    >
                      {projects.map((p) => (
                        <option key={p.projectId} value={p.projectId}>
                          {p.projectCode} - {p.clientName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBatchProcessing}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-teal-300 hover:bg-teal-50 disabled:opacity-50 text-teal-800 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition"
                    title="เลือกไฟล์เพิ่ม (หน้าต่างคอมจะแสดงรูปตัวอย่างขนาดใหญ่)"
                  >
                    <Images className="w-3.5 h-3.5 text-teal-600" />
                    + เพิ่มไฟล์ (เห็นรูปตัวอย่าง)
                  </button>

                  <button
                    onClick={() => folderInputRef.current?.click()}
                    disabled={isBatchProcessing}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    <FolderUp className="w-3.5 h-3.5 text-slate-500" />
                    + โฟลเดอร์
                  </button>

                  <button
                    onClick={() => startBatchOCR()}
                    disabled={isBatchProcessing || (batchPendingCount === 0 && batchFailedCount === 0)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#12304A] hover:bg-[#1a4468] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    {isBatchProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : batchPendingCount === 0 && batchFailedCount > 0 ? (
                      <RotateCcw className="w-4 h-4 text-amber-300" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>
                      {isBatchProcessing
                        ? 'กำลังอ่าน AI OCR...'
                        : batchPendingCount > 0
                        ? `เริ่มประมวลผล AI OCR (${batchPendingCount} ไฟล์)`
                        : batchFailedCount > 0
                        ? `ลองอ่านไฟล์ที่ไม่สำเร็จใหม่ (${batchFailedCount} ไฟล์)`
                        : 'อ่านครบทุกไฟล์แล้ว'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Processing Progress Bar */}
              {isBatchProcessing && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-teal-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      กำลังอ่านเอกสาร: {batchProgress.currentFileName}
                    </span>
                    <span className="text-teal-700 font-mono">
                      {batchProgress.current} / {batchProgress.total} ({Math.round((batchProgress.current / batchProgress.total) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-teal-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#0D9488] h-2 transition-all duration-300"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* View Mode Toggle & Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    ภาพตัวอย่างเอกสารในชุด ({batchItems.length} ไฟล์):
                  </span>
                  <span className="text-[11px] text-teal-700 hidden sm:inline">
                    (คลิกที่ภาพเพื่อขยายดูรูปตัวอย่างขนาดเต็ม)
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setBatchViewMode('gallery')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      batchViewMode === 'gallery'
                        ? 'bg-white text-teal-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    แกลเลอรี่รูปตัวอย่าง
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchViewMode('table')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      batchViewMode === 'table'
                        ? 'bg-white text-teal-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    ตาราง
                  </button>
                </div>
              </div>

              {/* GALLERY VIEW: Visual Thumbnail Cards */}
              {batchViewMode === 'gallery' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto p-1">
                  {batchItems.map((item, idx) => {
                    const ext = item.extracted;
                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col group"
                      >
                        {/* Thumbnail Container */}
                        <div
                          className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden cursor-pointer flex items-center justify-center border-b border-slate-100"
                          onClick={() => item.base64 && setZoomPreviewUrl(item.base64)}
                          title="คลิกเพื่อขยายดูภาพตัวอย่าง"
                        >
                          {!item.isPdf && item.base64 ? (
                            <img
                              src={item.base64}
                              alt={item.fileName}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50/70 text-rose-600 p-2">
                              <FileText className="w-9 h-9 mb-1" />
                              <span className="text-[10px] font-bold">เอกสาร PDF</span>
                              {ext?.totalPagesRead && ext.totalPagesRead > 1 && (
                                <span className="text-[9px] text-rose-500">
                                  {ext.totalPagesRead} หน้า
                                </span>
                              )}
                            </div>
                          )}

                          {/* Hover Zoom Overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 text-white transition pointer-events-none">
                            <Eye className="w-4 h-4" />
                            <span className="text-[11px] font-semibold">ดูภาพขยาย</span>
                          </div>

                          {/* Number badge */}
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono font-bold">
                            #{idx + 1}
                          </div>

                          {/* Status Pill on top-right */}
                          <div className="absolute top-1.5 right-1.5">
                            {item.savedReceiptId ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white shadow-2xs">
                                ✓ บันทึกแล้ว
                              </span>
                            ) : item.status === 'processing' ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white shadow-2xs flex items-center gap-1">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> อ่าน...
                              </span>
                            ) : item.status === 'completed' ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white shadow-2xs">
                                ✓ สำเร็จ
                              </span>
                            ) : item.status === 'needs_review' ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-600 text-white shadow-2xs">
                                ตรวจทาน
                              </span>
                            ) : item.status === 'duplicate' ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-600 text-white shadow-2xs">
                                อาจซ้ำ
                              </span>
                            ) : item.status === 'failed' ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-600 text-white shadow-2xs">
                                ไม่สำเร็จ
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800/80 text-white">
                                รออ่าน
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Info Body */}
                        <div className="p-2.5 text-xs flex-1 flex flex-col justify-between space-y-1.5">
                          <div>
                            <span
                              className="font-bold text-slate-900 block truncate text-xs"
                              title={item.fileName}
                            >
                              {item.fileName}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {(item.fileSize / 1024).toFixed(0)} KB {item.isPdf && '· PDF'}
                            </span>
                          </div>

                          {/* Extracted Details */}
                          {ext ? (
                            <div className="pt-1.5 border-t border-slate-100 text-[11px] space-y-0.5">
                              <div className="font-semibold text-slate-800 truncate" title={ext.vendorName}>
                                {ext.vendorName || 'ไม่ระบุชื่อร้าน'}
                              </div>
                              <div className="flex items-center justify-between text-slate-500 text-[10px]">
                                <span>{ext.documentDate || '-'}</span>
                                <span className="font-mono font-bold text-teal-800 text-[11px]">
                                  {formatCurrency(Number(ext.grandTotal) || 0)}
                                </span>
                              </div>
                            </div>
                          ) : item.status === 'failed' ? (
                            <div className="pt-1 border-t border-rose-100 text-[10px] text-rose-600 space-y-1">
                              <div className="truncate font-medium" title={item.errorMessage}>
                                ⚠️ {item.errorMessage || 'อ่านไม่สำเร็จ'}
                              </div>
                              <button
                                type="button"
                                onClick={() => startBatchOCR(item.id)}
                                disabled={isBatchProcessing}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                              >
                                <RotateCcw className="w-2.5 h-2.5" /> ลองอ่านไฟล์นี้ใหม่
                              </button>
                            </div>
                          ) : (
                            <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                              รอกดเริ่มอ่าน AI OCR
                            </div>
                          )}

                          {/* Quick Actions */}
                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingBatchItemIndex(idx)}
                              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-50 rounded cursor-pointer transition"
                            >
                              <Edit3 className="w-3 h-3" />
                              ตรวจทาน
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBatchItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition"
                              title="ลบออกจากชุด"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* TABLE VIEW WITH THUMBNAIL PREVIEW COLUMN */
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto max-h-[380px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center">#</th>
                          <th className="px-3 py-2.5 w-16 text-center">รูปตัวอย่าง</th>
                          <th className="px-3 py-2.5">ชื่อไฟล์ / ประเภท</th>
                          <th className="px-3 py-2.5">สถานะ</th>
                          <th className="px-3 py-2.5">ร้านค้า / ผู้จำหน่าย</th>
                          <th className="px-3 py-2.5">วันที่</th>
                          <th className="px-3 py-2.5">เลขที่</th>
                          <th className="px-3 py-2.5 text-right">ยอดสุทธิ (฿)</th>
                          <th className="px-3 py-2.5 text-center w-24">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batchItems.map((item, idx) => {
                          const ext = item.extracted;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* Thumbnail Image Cell */}
                              <td className="px-2 py-1.5 text-center">
                                {!item.isPdf && item.base64 ? (
                                  <div
                                    className="relative group w-11 h-11 mx-auto rounded-lg overflow-hidden border border-slate-200 cursor-pointer shadow-2xs hover:opacity-90 transition shrink-0"
                                    onClick={() => setZoomPreviewUrl(item.base64)}
                                    title="คลิกเพื่อขยายดูภาพตัวอย่าง"
                                  >
                                    <img
                                      src={item.base64}
                                      alt={item.fileName}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                      <Eye className="w-3 h-3 text-white" />
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className="w-11 h-11 mx-auto rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex flex-col items-center justify-center cursor-pointer hover:bg-rose-100 transition shadow-2xs"
                                    onClick={() => item.base64 && setZoomPreviewUrl(item.base64)}
                                    title="คลิกเพื่อดูตัวอย่างไฟล์ PDF"
                                  >
                                    <FileText className="w-4 h-4 text-rose-500" />
                                    <span className="text-[8px] font-bold">PDF</span>
                                  </div>
                                )}
                              </td>

                              <td className="px-3 py-2">
                                <div className="truncate max-w-[180px]" title={item.fileName}>
                                  <span className="font-medium text-slate-800 block truncate text-xs">
                                    {item.fileName}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {(item.fileSize / 1024).toFixed(0)} KB {item.isPdf && '· PDF'}
                                    {ext?.totalPagesRead && ext.totalPagesRead > 1 && ` (${ext.totalPagesRead} หน้า)`}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                {item.savedReceiptId ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    <Check className="w-3 h-3 text-blue-600" /> บันทึกแล้ว
                                  </span>
                                ) : item.status === 'processing' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 animate-pulse border border-teal-200">
                                    <Loader2 className="w-3 h-3 animate-spin" /> กำลังอ่าน...
                                  </span>
                                ) : item.status === 'completed' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> อ่านสำเร็จ
                                  </span>
                                ) : item.status === 'needs_review' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" /> ต้องตรวจทาน
                                  </span>
                                ) : item.status === 'duplicate' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200" title={item.duplicateReason}>
                                    <AlertCircle className="w-3 h-3 text-orange-600" /> อาจซ้ำ
                                  </span>
                                ) : item.status === 'failed' ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200" title={item.errorMessage}>
                                      <XCircle className="w-3 h-3 text-red-600" /> ผิดพลาด
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => startBatchOCR(item.id)}
                                      disabled={isBatchProcessing}
                                      className="text-[10px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                                      title="ลองอ่านไฟล์นี้ใหม่"
                                    >
                                      ลองใหม่
                                    </button>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                    <Clock className="w-3 h-3 text-slate-400" /> รอดำเนินการ
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-800 font-medium truncate max-w-[140px]" title={ext?.vendorName}>
                                {ext?.vendorName || '-'}
                              </td>
                              <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                                {ext?.documentDate || '-'}
                              </td>
                              <td className="px-3 py-2 text-slate-600 font-mono text-[11px] truncate max-w-[100px]">
                                {ext?.receiptNumber || '-'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                                {ext ? formatCurrency(Number(ext.grandTotal) || 0) : '-'}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setEditingBatchItemIndex(idx)}
                                    className="p-1 rounded text-teal-700 hover:bg-teal-50 cursor-pointer"
                                    title="ตรวจทานหรือแก้ไขข้อมูล"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => removeBatchItem(item.id)}
                                    className="p-1 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                                    title="ลบออกจากชุด"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-Editor Modal for a Batch Item */}
              {editingBatchItemIndex !== null && batchItems[editingBatchItemIndex] && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200">
                    <div className="px-4 py-3 bg-[#12304A] text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-teal-400" />
                        <span className="font-bold text-sm">
                          ตรวจทานใบเสร็จ: {batchItems[editingBatchItemIndex].fileName}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditingBatchItemIndex(null)}
                        className="p-1 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Preview */}
                        <div className="h-[280px] bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                          {batchItems[editingBatchItemIndex].isPdf ? (
                            <iframe
                              src={batchItems[editingBatchItemIndex].base64}
                              title="PDF Preview"
                              className="w-full h-full bg-white"
                            />
                          ) : (
                            <img
                              src={batchItems[editingBatchItemIndex].base64}
                              alt="Receipt"
                              className="max-h-full max-w-full object-contain p-2"
                            />
                          )}
                        </div>

                        {/* Editable Form */}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">ชื่อร้านค้า / ผู้ขาย</label>
                            <input
                              type="text"
                              value={batchItems[editingBatchItemIndex].extracted?.vendorName || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setBatchItems((prev) =>
                                  prev.map((it, i) =>
                                    i === editingBatchItemIndex
                                      ? {
                                          ...it,
                                          extracted: {
                                            ...(it.extracted || ({} as any)),
                                            vendorName: v,
                                          },
                                        }
                                      : it
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)</label>
                            <input
                              type="text"
                              value={batchItems[editingBatchItemIndex].extracted?.vendorAddress || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setBatchItems((prev) =>
                                  prev.map((it, i) =>
                                    i === editingBatchItemIndex
                                      ? {
                                          ...it,
                                          extracted: {
                                            ...(it.extracted || ({} as any)),
                                            vendorAddress: v,
                                          },
                                        }
                                      : it
                                  )
                                );
                              }}
                              placeholder="ที่อยู่ผู้ขายตามบิล..."
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-teal-800 mb-1">ชื่อลูกค้า / ผู้ซื้อ (ในบิล)</label>
                              <input
                                type="text"
                                value={batchItems[editingBatchItemIndex].extracted?.customerName || ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBatchItems((prev) =>
                                    prev.map((it, i) =>
                                      i === editingBatchItemIndex
                                        ? {
                                            ...it,
                                            extracted: {
                                              ...(it.extracted || ({} as any)),
                                              customerName: v,
                                            },
                                          }
                                        : it
                                    )
                                  );
                                }}
                                placeholder="ชื่อผู้ซื้อ/ลูกค้าในบิล..."
                                className="w-full px-2.5 py-1.5 border border-teal-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-teal-800 mb-1">เลขผู้เสียภาษีผู้ซื้อ</label>
                              <input
                                type="text"
                                value={batchItems[editingBatchItemIndex].extracted?.customerTaxId || ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBatchItems((prev) =>
                                    prev.map((it, i) =>
                                      i === editingBatchItemIndex
                                        ? {
                                            ...it,
                                            extracted: {
                                              ...(it.extracted || ({} as any)),
                                              customerTaxId: v,
                                            },
                                          }
                                        : it
                                    )
                                  );
                                }}
                                placeholder="เลข 13 หลักผู้ซื้อ"
                                className="w-full px-2.5 py-1.5 border border-teal-300 rounded-lg font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-teal-800 mb-1">ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)</label>
                            <input
                              type="text"
                              value={batchItems[editingBatchItemIndex].extracted?.customerAddress || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setBatchItems((prev) =>
                                  prev.map((it, i) =>
                                    i === editingBatchItemIndex
                                      ? {
                                          ...it,
                                          extracted: {
                                            ...(it.extracted || ({} as any)),
                                            customerAddress: v,
                                          },
                                        }
                                      : it
                                  )
                                );
                              }}
                              placeholder="ที่อยู่ผู้ซื้อ/ลูกค้าตามบิล..."
                              className="w-full px-2.5 py-1.5 border border-teal-300 rounded-lg"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">วันที่</label>
                              <input
                                type="date"
                                value={batchItems[editingBatchItemIndex].extracted?.documentDate || ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBatchItems((prev) =>
                                    prev.map((it, i) =>
                                      i === editingBatchItemIndex
                                        ? {
                                            ...it,
                                            extracted: {
                                              ...(it.extracted || ({} as any)),
                                              documentDate: v,
                                            },
                                          }
                                        : it
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">เลขที่ใบเสร็จ</label>
                              <input
                                type="text"
                                value={batchItems[editingBatchItemIndex].extracted?.receiptNumber || ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBatchItems((prev) =>
                                    prev.map((it, i) =>
                                      i === editingBatchItemIndex
                                        ? {
                                            ...it,
                                            extracted: {
                                              ...(it.extracted || ({} as any)),
                                              receiptNumber: v,
                                            },
                                          }
                                        : it
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">ยอดสุทธิ (Grand Total ฿)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={batchItems[editingBatchItemIndex].extracted?.grandTotal || ''}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setBatchItems((prev) =>
                                  prev.map((it, i) =>
                                    i === editingBatchItemIndex
                                      ? {
                                          ...it,
                                          extracted: {
                                            ...(it.extracted || ({} as any)),
                                            grandTotal: v,
                                          },
                                        }
                                      : it
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-teal-800 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">โครงการ</label>
                            <select
                              value={batchItems[editingBatchItemIndex].projectId}
                              onChange={(e) => {
                                const v = e.target.value;
                                setBatchItems((prev) =>
                                  prev.map((it, i) => (i === editingBatchItemIndex ? { ...it, projectId: v } : it))
                                );
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                            >
                              {projects.map((p) => (
                                <option key={p.projectId} value={p.projectId}>
                                  {p.projectCode} - {p.clientName}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                      <button
                        onClick={() => setEditingBatchItemIndex(null)}
                        className="px-4 py-1.5 bg-[#0D9488] text-white rounded-lg font-semibold text-xs cursor-pointer hover:bg-teal-700"
                      >
                        บันทึกการแก้ไข
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <>
              {/* ============================================================== */}
              {/* STEP 1 & 2: Select Project & Upload Mode                        */}
              {/* ============================================================== */}
              {currentStep < 3 ? (
                <div className="max-w-xl mx-auto space-y-5">
                  
                  {/* STEP 1: Select Project */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      1. เลือกโครงการ (ลูกค้า หรือ หน่วยงาน) ที่ต้องการบันทึกค่าใช้จ่าย <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                    >
                      <option value="" disabled>-- กรุณาเลือกโครงการ (ลูกค้า/หน่วยงาน) --</option>
                      {projects.map((p) => (
                        <option key={p.projectId} value={p.projectId}>
                          {p.projectCode} - {p.clientName}
                        </option>
                      ))}
                    </select>

                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-slate-700">
                          2. เลือกหมวดหมู่เบื้องต้น (หรือให้ AI เสนอหมวดหมู่)
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddCatModalOpen(true)}
                          className="flex items-center gap-1 text-[11px] text-teal-700 font-bold hover:underline cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> + เพิ่มหมวดหมู่
                        </button>
                      </div>
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                      >
                        {mainCategories.map((main) => {
                          const subs = getSubcategories(main.categoryId);
                          return (
                            <optgroup key={main.categoryId} label={`📁 ${main.categoryName}`}>
                              <option value={main.categoryId}>📁 {main.categoryName} (หมวดหมู่หลัก)</option>
                              {subs.map((sub) => (
                                <option key={sub.categoryId} value={sub.categoryId}>
                                  &nbsp;&nbsp;↳ {sub.categoryName}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                        {categories
                          .filter((c) => !mainCategories.some((m) => m.categoryId === c.categoryId) && !c.parentId)
                          .map((c) => (
                            <option key={c.categoryId} value={c.categoryId}>
                              {c.categoryName}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* STEP 2: Upload receipt image or take photo or folder import */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-5 sm:p-7 text-center transition-all ${
                      isDraggingOver
                        ? 'border-teal-500 bg-teal-50 ring-4 ring-teal-500/20 scale-[0.99]'
                        : 'border-slate-300 hover:border-teal-600 bg-slate-50/50 hover:bg-teal-50/20'
                    }`}
                  >
                    {/* Hidden Native File Inputs */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {/* Folder Picker Native Input */}
                    <input
                      type="file"
                      ref={folderInputRef}
                      // @ts-expect-error webkitdirectory is standard for folder picker
                      webkitdirectory=""
                      directory=""
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <input
                      type="file"
                      ref={cameraInputRef}
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="w-14 h-14 mx-auto rounded-full bg-teal-100/70 text-[#0D9488] flex items-center justify-center mb-3">
                      <FolderUp className="w-7 h-7" />
                    </div>

                    <h3 className="text-sm font-bold text-slate-800">
                      เลือกวิธีนำเข้าใบเสร็จ (ภาพเดี่ยว, หลายไฟล์ หรือทั้งโฟลเดอร์)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      รองรับไฟล์ JPG, PNG, WebP และ PDF หลายหน้า (ระบบจะสแกนอ่านครบทุกหน้า)
                    </p>

                    {/* Important Guidance Box: OS Folder Picker explanation */}
                    <div className="mt-4 mb-2 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-left text-xs text-amber-950 shadow-2xs">
                      <div className="flex items-start gap-2.5">
                        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1.5 flex-1">
                          <p className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                            💡 ทำไมเปิดโฟลเดอร์ในคอมแล้วมองไม่เห็นรูปตัวอย่างไฟล์?
                          </p>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            หน้าต่างเลือกโฟลเดอร์ของระบบ <strong>Windows และ Mac</strong> ถูกออกแบบมาสำหรับ <strong>คลิกเลือกชื่อโฟลเดอร์จากภายนอก</strong> แล้วกดปุ่ม Upload (หากดับเบิ้ลคลิกเข้าไปข้างใน หน้าต่างคอมฯ จะไม่แสดงไฟล์ใดๆ)
                          </p>
                          <div className="pt-1.5 border-t border-amber-200/60 text-[11px] text-teal-950 space-y-1 font-medium">
                            <div className="flex items-start gap-1.5">
                              <span className="text-emerald-700 font-bold shrink-0">👉 วิธีที่ 1 (แนะนำ - เห็นรูปตัวอย่างในคอมชัดเจน):</span>
                              <span>
                                กดปุ่ม <strong>"เลือกไฟล์ทั้งหมดในโฟลเดอร์"</strong> ด้านล่าง หน้าต่างคอมจะเปิดโหมดไฟล์ปกติ สามารถปรับเป็น Large Icons เพื่อดูรูปตัวอย่าง แล้วกด <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono">Ctrl + A</kbd> เพื่อเลือกทุกภาพได้ทันที!
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="text-teal-700 font-bold shrink-0">👉 วิธีที่ 2 (ลากมาวาง):</span>
                              <span>
                                เปิดโฟลเดอร์ในคอมที่คุณเห็นรูปตัวอย่าง แล้วลากทั้งโฟลเดอร์หรือลากไฟล์ทั้งหมดมาปล่อยลงในกรอบนี้ได้เลย
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                      {/* Option 1: Multi-File Picker with visible previews in OS */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!projectId}
                        className="flex flex-col items-center justify-between p-4 bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-teal-500 hover:border-teal-600 disabled:opacity-50 text-teal-950 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs group"
                      >
                        <div className="p-2.5 rounded-xl bg-teal-600 text-white shadow-xs group-hover:scale-105 transition">
                          <Images className="w-5 h-5" />
                        </div>
                        <div className="my-2">
                          <span className="block font-bold text-xs text-teal-950">
                            เลือกไฟล์ทั้งหมดในโฟลเดอร์
                          </span>
                          <span className="text-[10px] text-teal-700 font-normal block mt-0.5">
                            เห็นรูปตัวอย่างในคอม (กด Ctrl+A เพื่อเลือกทั้งหมด)
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full">
                          ⭐ แนะนำ - เห็นรูปในคอม
                        </span>
                      </button>

                      {/* Option 2: Entire Folder Import */}
                      <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        disabled={!projectId}
                        className="flex flex-col items-center justify-between p-4 bg-white border border-slate-300 hover:border-teal-500 hover:bg-teal-50/20 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs group"
                      >
                        <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-teal-100 text-[#12304A] group-hover:text-teal-700 transition">
                          <Folder className="w-5 h-5" />
                        </div>
                        <div className="my-2">
                          <span className="block font-bold text-xs text-slate-900">
                            เลือกแบบทั้งโฟลเดอร์
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal block mt-0.5">
                            คลิกชื่อโฟลเดอร์แล้วกด Select Folder
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                          Folder Mode
                        </span>
                      </button>

                      {/* Option 3: Mobile Camera */}
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={!projectId}
                        className="flex flex-col items-center justify-between p-4 bg-white border border-slate-200 hover:border-teal-500 hover:bg-teal-50/20 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs group"
                      >
                        <div className="p-2.5 rounded-lg bg-slate-100 group-hover:bg-teal-100 text-[#12304A] group-hover:text-teal-700 transition">
                          <Camera className="w-5 h-5" />
                        </div>
                        <div className="my-2">
                          <span className="block font-bold text-xs text-slate-900">
                            ถ่ายภาพด้วยกล้อง
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                            สำหรับมือถือและแท็บเล็ต
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                          กล้องสด
                        </span>
                      </button>
                    </div>

                    {/* Drag-and-drop indicator */}
                    <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Upload className="w-4 h-4 text-teal-600 animate-bounce" />
                      <span>หรือเปิดโฟลเดอร์ในคอม แล้ว<strong>ลากทั้งโฟลเดอร์หรือไฟล์ทั้งหมด</strong>มาวางในกรอบนี้ได้ทันที</span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2">
                      💡 <strong>รองรับไฟล์ PDF ที่มีหลายหน้า:</strong> AI จะวิเคราะห์และรวมยอดสินค้าทุกหน้ารวมกันเป็นยอดเดียวโดยอัตโนมัติ
                    </p>
                  </div>
                </div>
              ) : (
                /* ============================================================== */
                /* STEP 3: Review Single Receipt & Form                          */
                /* ============================================================== */
                <div className="space-y-4">
                  
                  {/* Needs Review / OCR Warning */}
                  {needsReview && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">เอกสารต้องการการตรวจสอบพิเศษ (Needs Review): </span>
                        <span>{reviewReasons.join(', ') || 'กรุณาตรวจสอบยอดรวมและข้อมูลใบเสร็จ'}</span>
                      </div>
                    </div>
                  )}

                  {/* Duplicate warning */}
                  {duplicateWarning && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">คำเตือนข้อมูลซ้ำซ้อน: </span>
                        <span>{duplicateWarning}</span>
                      </div>
                    </div>
                  )}

                  {/* AI Processing Status */}
                  {isProcessingAI && (
                    <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
                      <div>
                        <p className="font-bold flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                          กำลังประมวลผลด้วย Gemini 3.1 Flash Lite OCR (Auto-Fallback Ready)...
                        </p>
                        <p className="text-teal-700 text-[11px]">
                          ระบบกำลังอ่านข้อมูลทุกหน้า รวมรายการสินค้า แยกยอดก่อนภาษี VAT และตรวจยอดสุทธิ
                        </p>
                      </div>
                    </div>
                  )}

                  {/* OCR Error Notice */}
                  {ocrError && (
                    <div className="p-4 rounded-xl text-xs flex flex-col gap-3 shadow-xs border bg-rose-50 border-rose-200 text-rose-800">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-bold text-sm text-slate-900">
                            การอ่านข้อมูลเอกสารพบปัญหา
                          </h4>
                          <p className="mt-1 leading-relaxed text-slate-700 text-xs">
                            {ocrError}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-200/80 justify-end">
                        <button
                          type="button"
                          onClick={() => imageBase64 && imageFile && runAiOcr(imageBase64, imageFile.type, imageHash)}
                          disabled={isProcessingAI}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-50 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                        >
                          {isProcessingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          <span>{isProcessingAI ? 'กำลังอ่านข้อมูล...' : 'ลองอ่านภาพใหม่'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Multi-Page PDF Page-by-Page Inspector & Split Banner */}
                  {(isCurrentFilePdf || totalPagesRead > 1 || pdfPages.length > 0) && (
                    <div className="bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-slate-50 border-2 border-blue-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                            <FileStack className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900">
                                ตรวจพบเอกสาร PDF ทั้งหมด {totalPagesRead || pdfPages.length} หน้า
                              </h3>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                AI สแกนแยกหน้าครบถ้วน
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              ระบบสแกนอ่านและแยกรายการสินค้า/ยอดเงินตามแต่ละหน้าไว้ให้เรียบร้อยแล้ว
                            </p>
                          </div>
                        </div>

                        {/* Split Action Button */}
                        {totalPagesRead > 1 && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={handleSplitSavePdfPages}
                              disabled={isSaving || isProcessingAI}
                              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition active:scale-95"
                              title="แยกบันทึกเอกสาร PDF นี้ออกเป็นใบเสร็จเดี่ยวตามแต่ละหน้า"
                            >
                              <Split className="w-4 h-4" />
                              แยกบันทึกเป็น {totalPagesRead} ใบเสร็จ (ตามแต่ละหน้า)
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Page Navigation Tabs */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
                        <span className="text-slate-500 font-semibold shrink-0 flex items-center gap-1 text-[11px]">
                          เลือกดูข้อมูลตามหน้า:
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPageFilter('all')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                            selectedPageFilter === 'all'
                              ? 'bg-[#12304A] text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>📄 รวมทุกหน้า</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedPageFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                            {items.length} รายการ
                          </span>
                        </button>

                        {Array.from({ length: totalPagesRead || 1 }, (_, i) => {
                          const pNum = i + 1;
                          const pageData = pdfPages.find((p) => p.pageNumber === pNum);
                          const pageItemsCount = items.filter((it) => (it.pageNumber || 1) === pNum).length;
                          const isSelected = selectedPageFilter === pNum;

                          return (
                            <button
                              key={pNum}
                              type="button"
                              onClick={() => setSelectedPageFilter(pNum)}
                              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <span>หน้าที่ {pNum}</span>
                              {pageData?.vendorName && (
                                <span className="max-w-[110px] truncate text-[10px] font-normal opacity-85">
                                  ({pageData.vendorName})
                                </span>
                              )}
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                {pageItemsCount} รายการ
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Page Details Banner when a specific page is selected */}
                      {selectedPageFilter !== 'all' && (
                        <div className="bg-white border border-blue-200 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                          <div className="flex flex-wrap items-center gap-4">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">ร้านค้าประจำหน้า {selectedPageFilter}:</span>
                              <span className="font-bold text-slate-800">
                                {pdfPages.find((p) => p.pageNumber === selectedPageFilter)?.vendorName || vendorName || 'ตามฟอร์มหลัก'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">เลขที่บิลหน้า {selectedPageFilter}:</span>
                              <span className="font-mono font-bold text-slate-800">
                                {pdfPages.find((p) => p.pageNumber === selectedPageFilter)?.receiptNumber || (receiptNumber ? `${receiptNumber}-P${selectedPageFilter}` : `P${selectedPageFilter}`)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">ยอดรวมเฉพาะหน้านี้:</span>
                              <span className="font-mono font-bold text-blue-700">
                                {formatCurrency(
                                  pdfPages.find((p) => p.pageNumber === selectedPageFilter)?.grandTotal ||
                                  items.filter((it) => (it.pageNumber || 1) === selectedPageFilter).reduce((sum, it) => sum + (it.amount || 0), 0)
                                )} THB
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const p = pdfPages.find((pg) => pg.pageNumber === selectedPageFilter);
                              if (p) {
                                if (p.vendorName) setVendorName(p.vendorName);
                                if (p.vendorTaxId) setVendorTaxId(p.vendorTaxId);
                                if (p.vendorAddress) setVendorAddress(p.vendorAddress);
                                if (p.customerName) setCustomerName(p.customerName);
                                if (p.customerTaxId) setCustomerTaxId(p.customerTaxId);
                                if (p.customerAddress) setCustomerAddress(p.customerAddress);
                                if (p.receiptNumber) setReceiptNumber(p.receiptNumber);
                                if (p.documentDate) setDocumentDate(p.documentDate);
                                if (p.grandTotal) setGrandTotal(p.grandTotal);
                                if (p.subtotal) setSubtotal(p.subtotal);
                                if (p.vatAmount) setVatAmount(p.vatAmount);
                              }
                            }}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer transition"
                          >
                            นำข้อมูลหน้านี้มากรอกในฟอร์มหลัก
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Split Layout: Left Image, Right Form */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    
                    {/* Left Column: Image / PDF Preview (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col">
                      <div className="bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[320px] max-h-[520px] p-2 relative group">
                        {imageBase64 ? (
                          isCurrentFilePdf ? (
                            <iframe
                              src={imageBase64}
                              title="PDF Preview"
                              className="w-full h-[480px] rounded-lg bg-white border border-slate-700"
                            />
                          ) : (
                            <img
                              src={imageBase64}
                              alt="ภาพใบเสร็จ"
                              referrerPolicy="no-referrer"
                              className="max-h-[480px] w-auto max-w-full object-contain rounded-lg"
                            />
                          )
                        ) : (
                          <div className="text-slate-400 text-xs flex flex-col items-center gap-2">
                            <FileText className="w-8 h-8" />
                            <span>ไม่มีภาพใบเสร็จ</span>
                          </div>
                        )}
                      </div>

                      {/* PDF Multi-page Banner */}
                      {isCurrentFilePdf && (
                        <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                          <span className="font-semibold flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-blue-600" />
                            เอกสาร PDF: รวม {totalPagesRead} หน้า
                          </span>
                          <span className="text-[11px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded font-medium">
                            AI สแกนอ่านทุกหน้าครบถ้วน
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                        <span>
                          {imageFile ? `${imageFile.name} (${(imageFile.size / 1024).toFixed(0)} KB)` : 'ภาพบันทึก'}
                        </span>
                        <button
                          onClick={() => {
                            setImageBase64('');
                            setImageFile(null);
                            setCurrentStep(2);
                          }}
                          className="text-teal-700 hover:underline font-medium cursor-pointer"
                        >
                          เปลี่ยนภาพใหม่
                        </button>
                      </div>

                      {ocrNotes && (
                        <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-800 block">หมายเหตุจาก AI:</span>
                          {ocrNotes}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Editable Review Form (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200">
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            ข้อมูลเอกสารและการเงิน (ตรวจสอบและแก้ไขได้)
                          </h3>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>Engine: <strong className="font-mono">{modelUsed}</strong></span>
                            {fallbackTriggered ? (
                              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                ⚡ Auto-Fallback Active
                              </span>
                            ) : (
                              <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded text-[9px] font-medium">
                                ✓ Primary Engine
                              </span>
                            )}
                            {executionTimeMs !== null && (
                              <span className="text-slate-400 font-mono text-[9px]">
                                {(executionTimeMs / 1000).toFixed(2)}s
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* Project select */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              โครงการ <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={projectId}
                              onChange={(e) => setProjectId(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 font-medium"
                            >
                              {projects.map((p) => (
                                <option key={p.projectId} value={p.projectId}>
                                  {p.projectCode} - {p.clientName}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Category */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-semibold text-slate-600">
                                หมวดหมู่ค่าใช้จ่าย <span className="text-red-500">*</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => setIsAddCatModalOpen(true)}
                                className="flex items-center gap-1 text-[11px] text-teal-700 font-bold hover:underline cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> + เพิ่มหมวดหมู่
                              </button>
                            </div>
                            <select
                              value={categoryId}
                              onChange={(e) => setCategoryId(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900"
                            >
                              {mainCategories.map((main) => {
                                const subs = getSubcategories(main.categoryId);
                                return (
                                  <optgroup key={main.categoryId} label={`📁 ${main.categoryName}`}>
                                    <option value={main.categoryId}>📁 {main.categoryName} (หมวดหมู่หลัก)</option>
                                    {subs.map((sub) => (
                                      <option key={sub.categoryId} value={sub.categoryId}>
                                        &nbsp;&nbsp;↳ {sub.categoryName}
                                      </option>
                                    ))}
                                  </optgroup>
                                );
                              })}
                              {categories
                                .filter((c) => !mainCategories.some((m) => m.categoryId === c.categoryId) && !c.parentId)
                                .map((c) => (
                                  <option key={c.categoryId} value={c.categoryId}>
                                    {c.categoryName}
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Document Type */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              ประเภทเอกสาร
                            </label>
                            <select
                              value={documentType}
                              onChange={(e) => setDocumentType(e.target.value as any)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900"
                            >
                              <option value="receipt">ใบเสร็จรับเงิน (Receipt)</option>
                              <option value="tax_invoice">ใบกำกับภาษี (Tax Invoice)</option>
                              <option value="other">เอกสารอื่นๆ (Other)</option>
                            </select>
                          </div>

                          {/* Document Date */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              วันที่บนใบเสร็จ (สากล/พ.ศ.) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={documentDate}
                              onChange={(e) => setDocumentDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 font-mono"
                            />
                          </div>

                          {/* Receipt Number */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              เลขที่ใบเสร็จ
                            </label>
                            <input
                              type="text"
                              placeholder="เช่น REC-2024-001"
                              value={receiptNumber}
                              onChange={(e) => setReceiptNumber(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 font-mono"
                            />
                          </div>

                          {/* Vendor Name */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              ชื่อร้านค้า / ผู้ขาย <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="ชื่อร้านค้าหรือบริษัทผู้ขาย"
                              value={vendorName}
                              onChange={(e) => setVendorName(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900"
                            />
                          </div>

                          {/* Vendor Tax ID */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              เลขประจำตัวผู้เสียภาษีผู้ขาย
                            </label>
                            <input
                              type="text"
                              placeholder="เลข 13 หลักผู้ขาย"
                              value={vendorTaxId}
                              onChange={(e) => setVendorTaxId(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 font-mono"
                            />
                          </div>

                          {/* Payment Method */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              วิธีชำระเงิน
                            </label>
                            <select
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900"
                            >
                              <option value="เงินสด">เงินสด</option>
                              <option value="บัตรเครดิต">บัตรเครดิต</option>
                              <option value="โอนเงินผ่านธนาคาร">โอนเงินผ่านธนาคาร</option>
                              <option value="QR PromptPay">QR PromptPay</option>
                              <option value="อื่นๆ">อื่นๆ</option>
                            </select>
                          </div>

                          {/* Vendor Address */}
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)
                            </label>
                            <input
                              type="text"
                              placeholder="ที่อยู่ผู้ขายตามใบเสร็จหรือใบกำกับภาษี"
                              value={vendorAddress}
                              onChange={(e) => setVendorAddress(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900"
                            />
                          </div>

                          {/* Customer / Buyer Name */}
                          <div>
                            <label className="block text-[11px] font-semibold text-teal-800 mb-1">
                              ชื่อลูกค้า / ผู้ซื้อ (ในบิล)
                            </label>
                            <input
                              type="text"
                              placeholder="ชื่อลูกค้าหรือผู้ซื้อที่ระบุในบิล"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-teal-300 rounded-md bg-white text-slate-900 font-medium"
                            />
                          </div>

                          {/* Customer / Buyer Tax ID */}
                          <div>
                            <label className="block text-[11px] font-semibold text-teal-800 mb-1">
                              เลขประจำตัวผู้เสียภาษีผู้ซื้อ
                            </label>
                            <input
                              type="text"
                              placeholder="เลข 13 หลักผู้ซื้อ (ถ้ามี)"
                              value={customerTaxId}
                              onChange={(e) => setCustomerTaxId(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-teal-300 rounded-md bg-white text-slate-900 font-mono"
                            />
                          </div>

                          {/* Customer / Buyer Address */}
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-teal-800 mb-1">
                              ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)
                            </label>
                            <input
                              type="text"
                              placeholder="ที่อยู่ผู้ซื้อหรือลูกค้าตามใบเสร็จ/ใบกำกับภาษี"
                              value={customerAddress}
                              onChange={(e) => setCustomerAddress(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-teal-300 rounded-md bg-white text-slate-900"
                            />
                          </div>
                        </div>

                        {/* Financial Calculations Grid */}
                        <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              ยอดก่อนภาษี
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={subtotal}
                              onChange={(e) => setSubtotal(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 font-mono text-right"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              VAT 7%
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={vatAmount}
                              onChange={(e) => setVatAmount(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 font-mono text-right"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              หัก ณ ที่จ่าย
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={withholdingTax}
                              onChange={(e) => setWithholdingTax(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 font-mono text-right"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              ส่วนลด
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={discount}
                              onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 font-mono text-right"
                            />
                          </div>
                        </div>

                        {/* Grand Total Highlight */}
                        <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-teal-900 block">
                              ยอดสุทธิที่ชำระ (Grand Total) <span className="text-red-500">*</span>
                            </span>
                            <span className="text-[11px] text-teal-700">
                              คำนวณอัตโนมัติ: {formatCurrency(calculatedGrandTotal)} THB
                            </span>
                          </div>
                          <div className="w-36">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={grandTotal}
                              onChange={(e) => setGrandTotal(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-teal-300 rounded-md bg-white text-teal-950 font-bold text-sm font-mono text-right focus:ring-2 focus:ring-teal-600"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Items breakdown list */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              รายการสินค้า/บริการย่อย ({selectedPageFilter === 'all' ? items.length : items.filter((it) => (it.pageNumber || 1) === selectedPageFilter).length} รายการ)
                            </span>
                            {selectedPageFilter !== 'all' && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                                กรองเฉพาะหน้า {selectedPageFilter}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleAddItem}
                            className="flex items-center gap-1 text-xs text-teal-700 font-semibold hover:underline cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            เพิ่มรายการ
                          </button>
                        </div>

                        {items.length > 0 ? (
                          <div className="space-y-2 max-h-[180px] overflow-y-auto">
                            {items
                              .map((it, idx) => ({ it, originalIdx: idx }))
                              .filter(({ it }) => selectedPageFilter === 'all' || (it.pageNumber || 1) === selectedPageFilter)
                              .map(({ it, originalIdx }) => (
                                <div key={originalIdx} className="flex items-center gap-1.5 text-xs">
                                  {(isCurrentFilePdf || totalPagesRead > 1) && (
                                    <select
                                      value={it.pageNumber || 1}
                                      onChange={(e) => handleUpdateItem(originalIdx, 'pageNumber', Number(e.target.value))}
                                      className="w-16 px-1 py-1 text-[10px] font-mono font-bold border border-blue-200 rounded bg-blue-50 text-blue-900 shrink-0"
                                      title="หน้าที่ในเอกสาร PDF"
                                    >
                                      {Array.from({ length: totalPagesRead || 1 }, (_, p) => (
                                        <option key={p + 1} value={p + 1}>
                                          หน้า {p + 1}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  <input
                                    type="text"
                                    placeholder="ชื่อสินค้า/บริการ"
                                    value={it.itemName}
                                    onChange={(e) => handleUpdateItem(originalIdx, 'itemName', e.target.value)}
                                    className="flex-1 min-w-[120px] px-2 py-1 border border-slate-300 rounded bg-white text-slate-900"
                                  />
                                  <input
                                    type="number"
                                    placeholder="จำนวน"
                                    value={it.quantity}
                                    onChange={(e) => handleUpdateItem(originalIdx, 'quantity', e.target.value)}
                                    className="w-12 px-1.5 py-1 border border-slate-300 rounded bg-white text-slate-900 font-mono text-right"
                                  />
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="ราคา"
                                    value={it.unitPrice}
                                    onChange={(e) => handleUpdateItem(originalIdx, 'unitPrice', e.target.value)}
                                    className="w-16 px-1.5 py-1 border border-slate-300 rounded bg-white text-slate-900 font-mono text-right"
                                  />
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="รวม"
                                    value={it.amount}
                                    onChange={(e) => handleUpdateItem(originalIdx, 'amount', e.target.value)}
                                    className="w-20 px-1.5 py-1 border border-slate-300 rounded bg-white text-slate-900 font-mono text-right font-semibold"
                                  />
                                  <button
                                    onClick={() => handleRemoveItem(originalIdx)}
                                    className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 py-1 text-center">
                            ไม่มีการแตกรายการสินค้าแยกย่อย (ใช้ยอดรวมใบเสร็จ)
                          </p>
                        )}
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          หมายเหตุเพิ่มเติม
                        </label>
                        <textarea
                          rows={2}
                          placeholder="บันทึกรายละเอียดเพิ่มเติมสำหรับผู้ตรวจสอบหรือฝ่ายบัญชี..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </div>

                    </div>
                  </div>

                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            {isBatchMode ? (
              <button
                onClick={() => {
                  if (confirm('คุณต้องการยกเลิกการนำเข้าชุดนี้และกลับสู่หน้าหลักหรือไม่?')) {
                    handleReset();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                ล้างคิวและเริ่มใหม่
              </button>
            ) : (
              currentStep === 3 && (
                <button
                  type="button"
                  onClick={() => {
                    if (imageBase64 && imageFile) {
                      runAiOcr(imageBase64, imageFile.type, imageHash);
                    }
                  }}
                  disabled={isProcessingAI}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                >
                  {isProcessingAI ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>{isProcessingAI ? 'กำลังอ่านภาพ...' : 'อ่านภาพใหม่ (Rescan)'}</span>
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              {isBatchMode && batchSavedCount > 0 ? 'ปิดหน้าต่าง' : 'ยกเลิก'}
            </button>

            {isBatchMode ? (
              <button
                onClick={saveAllBatchItems}
                disabled={isSaving || isBatchProcessing || batchReadyCount === 0}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-teal-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>บันทึกใบเสร็จทั้งหมด ({batchReadyCount} รายการ)</span>
              </button>
            ) : (
              currentStep === 3 && (
                <>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={isSaving || isProcessingAI}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    บันทึกฉบับร่าง
                  </button>

                  {(isCurrentFilePdf || totalPagesRead > 1 || pdfPages.length > 1) && totalPagesRead > 1 && (
                    <button
                      type="button"
                      onClick={handleSplitSavePdfPages}
                      disabled={isSaving || isProcessingAI}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer transition active:scale-95"
                      title="แยกเอกสาร PDF นี้และบันทึกเป็นใบเสร็จเดี่ยวตามแต่ละหน้า"
                    >
                      <Split className="w-4 h-4" />
                      แยกบันทึก {totalPagesRead} ใบเสร็จ (ตามหน้า)
                    </button>
                  )}

                  <button
                    onClick={() => handleSave(false)}
                    disabled={isSaving || isProcessingAI}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-teal-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {totalPagesRead > 1 ? 'บันทึกรวมทุกหน้าเป็น 1 ใบเสร็จ' : 'ยืนยันและบันทึก'}
                  </button>
                </>
              )
            )}
          </div>
        </div>

      </div>

      {/* Quick Add Category Modal (หมวดหมู่หลัก & หมวดหมู่ย่อย) */}
      {isAddCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-teal-600" />
                <h4 className="text-sm font-bold text-slate-900">เพิ่มหมวดหมู่ค่าใช้จ่ายใหม่</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCatModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCategory} className="space-y-3 text-xs">
              {/* Toggle Mode: Main vs Sub */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  ระดับหมวดหมู่:
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setCatAddMode('main');
                      setNewCatParentId('');
                    }}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      catAddMode === 'main'
                        ? 'bg-white text-[#12304A] shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FolderTree className="w-3.5 h-3.5 text-teal-600" />
                    หมวดหมู่หลัก (Main)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCatAddMode('sub');
                      if (!newCatParentId && mainCategories.length > 0) {
                        setNewCatParentId(mainCategories[0].categoryId);
                      }
                    }}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      catAddMode === 'sub'
                        ? 'bg-white text-[#12304A] shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <CornerDownRight className="w-3.5 h-3.5 text-teal-600" />
                    หมวดหมู่ย่อย (Sub)
                  </button>
                </div>
              </div>

              {/* If Sub-category, choose Parent Main Category */}
              {catAddMode === 'sub' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    สังกัดหมวดหมู่หลัก: <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newCatParentId}
                    onChange={(e) => setNewCatParentId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    required
                  >
                    <option value="">-- เลือกหมวดหมู่หลัก --</option>
                    {mainCategories.map((m) => (
                      <option key={m.categoryId} value={m.categoryId}>
                        📁 {m.categoryName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {catAddMode === 'main' ? 'ชื่อหมวดหมู่หลักใหม่:' : 'ชื่อหมวดหมู่ย่อยใหม่:'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    catAddMode === 'main'
                      ? 'เช่น ค่าบริการวิชาชีพ, ค่าสาธารณูปโภค'
                      : 'เช่น ค่าน้ำมันเชื้อเพลิง, ค่าทางด่วน'
                  }
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  required
                  autoFocus
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCatModalOpen(false)}
                  className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingCat || !newCatName.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0D9488] hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  {isSavingCat ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  บันทึกและเลือกทันที
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* High-Resolution Zoom Preview Modal */}
      {zoomPreviewUrl && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs"
          onClick={() => setZoomPreviewUrl(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-[#12304A] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-teal-400" />
                <span className="font-bold text-sm">ภาพตัวอย่างเอกสารใบเสร็จ</span>
              </div>
              <button
                type="button"
                onClick={() => setZoomPreviewUrl(null)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-slate-100 flex-1 overflow-auto flex items-center justify-center max-h-[calc(92vh-60px)]">
              {zoomPreviewUrl.startsWith('data:application/pdf') || zoomPreviewUrl.includes('.pdf') ? (
                <iframe
                  src={zoomPreviewUrl}
                  title="PDF Document"
                  className="w-full h-[75vh] bg-white rounded-xl shadow-xs border border-slate-200"
                />
              ) : (
                <img
                  src={zoomPreviewUrl}
                  alt="Receipt Preview"
                  className="max-h-[78vh] w-auto max-w-full object-contain rounded-xl shadow-md border border-slate-200"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
