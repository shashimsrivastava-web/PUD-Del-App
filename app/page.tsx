'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Database, 
  Upload, 
  Activity, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCcw, 
  ScanLine, 
  Plane, 
  MapPin, 
  User, 
  FileSpreadsheet, 
  ChevronRight,
  ChevronLeft,
  Filter,
  Trash,
  HelpCircle,
  Camera,
  Layers,
  CameraOff,
  Lock,
  Unlock,
  ShieldAlert,
  Wrench,
  Settings,
  Check,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import logo from '@/src/assets/images/rush_bag_logo_1782153528149.jpg';
import { parseBagTag, AIRLINE_NAMES } from '@/lib/baggageParser';
import { BaggageItem, LocationItem, AuditLog, ManifestItem, ManifestRow } from '@/lib/db-store';
import * as XLSX from 'xlsx';

export default function Home() {
  // Current active operator (defaults to shashi.ooo.2019@gmail.com)
  const [operatorId, setOperatorId] = useState('shashi.ooo.2019@gmail.com');
  const [isEditingOperator, setIsEditingOperator] = useState(false);
  const [operatorInput, setOperatorInput] = useState(operatorId);

  // Database content state loaded from our full-stack server endpoints
  const [baggageItems, setBaggageItems] = useState<BaggageItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [manifests, setManifests] = useState<ManifestItem[]>([]);
  const [rawAllBaggageItems, setRawAllBaggageItems] = useState<BaggageItem[]>([]); // includes deleted

  // Loading & status
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  // Form states - Register Bag
  const [scanTagInput, setScanTagInput] = useState('');
  const [scanLocationId, setScanLocationId] = useState('');
  const [scanStatus, setScanStatus] = useState('Scanned');
  const [scanReason, setScanReason] = useState('Initial Scanning');
  
  // Register Form FAA tracking fields
  const [scanPir, setScanPir] = useState('');
  const [scanPassengerName, setScanPassengerName] = useState('');
  const [scanOriginalTag, setScanOriginalTag] = useState('');
  const [scanRushTag, setScanRushTag] = useState('');
  const [scanFlightNo, setScanFlightNo] = useState('');
  const [scanSealNo, setScanSealNo] = useState('');
  const [scanDestination, setScanDestination] = useState('');
  const [scanRemarks, setScanRemarks] = useState('');

  // Computed derived value on-the-fly to comply with React best practices and eliminate effects
  const parsedFeedback = scanTagInput.trim() ? parseBagTag(scanTagInput) : null;

  // Form states - Create Location
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<'Storage' | 'Delivery'>('Delivery');
  const [isCreatingLoc, setIsCreatingLoc] = useState(false);

  // Form states - Upload manifest
  const [manifestFlightInput, setManifestFlightInput] = useState('');
  const [rawManifestPaste, setRawManifestPaste] = useState('');
  const [parsedManifestRows, setParsedManifestRows] = useState<any[] | null>(null);
  const [selectedManifestId, setSelectedManifestId] = useState('');
  const [manifestUploadFile, setManifestUploadFile] = useState<File | null>(null);

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocationId, setFilterLocationId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCarrier, setFilterCarrier] = useState('all');
  const [filterFlight, setFilterFlight] = useState('all');
  const [filterAgents, setFilterAgents] = useState<string[]>(['all']);

  // Admin Authentication states
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);

  // Flight filter state
  const [allowedFlights, setAllowedFlights] = useState<string[]>([]);
  const [newFlightsInput, setNewFlightsInput] = useState('');
  const [isProcessingFlights, setIsProcessingFlights] = useState(false);
  const [isReconcileSidebarCollapsed, setIsReconcileSidebarCollapsed] = useState(false);
  const [isExportingBDO, setIsExportingBDO] = useState(false);

  // Computed unique flight numbers from all manifests for autocomplete/options
  const uniqueManifestFlights = React.useMemo(() => {
    const flights = new Set<string>();
    manifests.forEach(m => {
      if (m.flight_number) {
        flights.add(m.flight_number.trim().toUpperCase());
      }
      if (m.rows) {
        m.rows.forEach(r => {
          if (r.flight_no) {
            flights.add(r.flight_no.trim().toUpperCase());
          }
        });
      }
    });
    return Array.from(flights).sort();
  }, [manifests]);

  // Combined flight options exclusively from unique values found in manifests
  const activeFlightOptions = uniqueManifestFlights;

  // Delivery agents DB state
  const [deliveryAgents, setDeliveryAgents] = useState<{ id: string; agent_name: string }[]>([]);
  const [newAgentName, setNewAgentName] = useState('');
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  // Baggage Dispo states (Register form)
  const [dispoType, setDispoType] = useState<'Storage Location' | 'Delivery Agent' | 'Handover to OAL' | 'Domestic forward' | 'DID NOT ARRIVE' | ''>('');
  const [dispoValue, setDispoValue] = useState('');
  const [dispoRemarks, setDispoRemarks] = useState('');

  // Baggage Dispo states (Amend form)
  const [amendDispoType, setAmendDispoType] = useState<'Storage Location' | 'Delivery Agent' | 'Handover to OAL' | 'Domestic forward' | 'DID NOT ARRIVE' | ''>('');
  const [amendDispoValue, setAmendDispoValue] = useState('');
  const [amendDispoRemarks, setAmendDispoRemarks] = useState('');

  // Amendment modal states
  const [editingBag, setEditingBag] = useState<BaggageItem | null>(null);
  const [amendLocationId, setAmendLocationId] = useState('');
  const [amendStatus, setAmendStatus] = useState('');
  const [amendReason, setAmendReason] = useState('Not cleared by customs');
  const [customAmendReason, setCustomAmendReason] = useState('');

  // Amendment Form FAA tracking fields
  const [amendPir, setAmendPir] = useState('');
  const [amendPassengerName, setAmendPassengerName] = useState('');
  const [amendOriginalTag, setAmendOriginalTag] = useState('');
  const [amendRushTag, setAmendRushTag] = useState('');
  const [amendFlightNo, setAmendFlightNo] = useState('');
  const [amendSealNo, setAmendSealNo] = useState('');
  const [amendDestination, setAmendDestination] = useState('');
  const [amendRemarks, setAmendRemarks] = useState('');

  // Deletion modal states
  const [deletingBag, setDeletingBag] = useState<BaggageItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('Passenger claimed early');
  const [customDeleteReason, setCustomDeleteReason] = useState('');

  // Custom dialog confirmation states for iframe capability
  const [customConfirmState, setCustomConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: (() => Promise<void> | void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Yes, Confirm',
    onConfirm: null,
  });

  // Tab state
  const [activeTab, setActiveTab ] = useState<'reconcile' | 'register' | 'batch-dispo' | 'search' | 'logs'>('reconcile');

  // Batch Disposition State
  const [batchLocationId, setBatchLocationId] = useState('');
  const [batchTagsInput, setBatchTagsInput] = useState('');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Manifest Row Selection & Editing
  const [selectedManifestRowIds, setSelectedManifestRowIds] = useState<string[]>([]);
  const [editingManifestRow, setEditingManifestRow] = useState<(ManifestRow & { manifestId?: string }) | null>(null);
  
  // Manifest Edit Form State
  const [manifestRowEditForm, setManifestRowEditForm] = useState<Partial<ManifestRow>>({});
  const [isUpdatingManifestRow, setIsUpdatingManifestRow] = useState(false);

  // Manifest Match State for Registration
  const [isManifestMatched, setIsManifestMatched] = useState(false);
  const [lastCheckedTag, setLastCheckedTag] = useState('');

  // Camera scanner states
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('environment');
  const scannerRef = useRef<any>(null);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch((e: any) => console.log("Scanner cleanup error:", e));
      }
    };
  }, []);

  // Start camera scanner
  const startCameraScan = async (cameraId: string = 'environment') => {
    setIsScanning(true);
    setScannerError(null);
    setSelectedCameraId(cameraId);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Delay slightly to permit element rendering
      setTimeout(async () => {
        try {
          if (scannerRef.current) {
            try {
              await scannerRef.current.stop();
            } catch (e) {}
            scannerRef.current = null;
          }

          const scanner = new Html5Qrcode("scanner-viewport");
          scannerRef.current = scanner;

          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              setCameras(devices);
            }
          } catch (cameraErr) {
            console.warn("Could not list camera devices directly:", cameraErr);
          }

          const config = cameraId === 'environment' 
            ? { facingMode: "environment" } 
            : { deviceId: { exact: cameraId } };

          await scanner.start(
            config,
            {
              fps: 15,
              qrbox: (videoWidth, videoHeight) => {
                return {
                  width: Math.floor(videoWidth * 0.85),
                  height: Math.floor(videoHeight * 0.4)
                };
              },
            },
            (decodedText) => {
              if (activeTab === 'batch-dispo') {
                setBatchTagsInput(prev => prev ? `${prev}\n${decodedText}` : decodedText);
              } else {
                setScanTagInput(decodedText);
              }
              
              scanner.stop().then(() => {
                scannerRef.current = null;
                setIsScanning(false);
                triggerNotification('success', `Barcode read successfully: ${decodedText}`);
              }).catch(() => {
                scannerRef.current = null;
                setIsScanning(false);
              });
            },
            (errorMessage) => {
              // Ignore frame analysis exceptions during ongoing stream
            }
          );
        } catch (startErr: any) {
          console.error("Scanner stream failed:", startErr);
          setScannerError(startErr?.message || "Failed to access video stream. Ensure camera permission code is enabled.");
        }
      }, 200);

    } catch (err: any) {
      console.error("Html5Qrcode module failed:", err);
      setScannerError("Could not load camera module.");
    }
  };

  // Stop camera scanner
  const stopCameraScan = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setScannerError(null);
  };

  // Triggering data load
  const loadData = async (silent = false) => {
    if (!silent) setIsDbLoading(true);
    try {
      const response = await fetch('/api/baggage');
      const json = await response.json();
      if (json.success) {
        setBaggageItems(json.data.baggage_items);
        setLocations(json.data.locations);
        setAuditLogs(json.data.audit_logs);
        setManifests(json.data.manifests);
        setRawAllBaggageItems(json.data.all_baggage_items_raw || json.data.baggage_items);
        if (json.data.delivery_agents) {
          setDeliveryAgents(json.data.delivery_agents);
        }
        if (json.data.allowed_flights) {
          setAllowedFlights(json.data.allowed_flights);
          setNewFlightsInput(json.data.allowed_flights.join(', '));
        }
        
        // Auto select first manifest if exists and none selected
        if (json.data.manifests && json.data.manifests.length > 0 && !selectedManifestId) {
          setSelectedManifestId(json.data.manifests[0].id);
        }
        
        // Auto select first location for scan input if empty
        if (json.data.locations && json.data.locations.length > 0 && !scanLocationId) {
          setScanLocationId(json.data.locations[0].id);
        }
      } else {
        setApiError(json.error || 'Failed to sync with baggage server database.');
      }
    } catch (err) {
      setApiError('Unable to connect to the backend server. Using offline data states.');
    } finally {
      setIsDbLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset selection when manifest changes
  useEffect(() => {
    setSelectedManifestRowIds([]);
  }, [selectedManifestId]);

  // Handle Automatic Manifest Matching during Registration - MOVED BELOW TO RESOLVE SCOPE ERRORS

  // Show status notification handler
  const triggerNotification = (type: 'success' | 'err', message: string) => {
    if (type === 'success') {
      setApiSuccess(message);
      setTimeout(() => setApiSuccess(null), 4000);
    } else {
      setApiError(message);
      setTimeout(() => setApiError(null), 5000);
    }
  };

  // 1. Submit scanned bag
  const handleRegisterBag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanTagInput.trim()) return;

    // Strict Enforcement logic if not matched
    if (!isManifestMatched) {
      if (!scanPir.trim() || !scanPassengerName.trim() || !scanFlightNo.trim() || !scanDestination.trim() || (!scanOriginalTag.trim() && !scanRushTag.trim())) {
        triggerNotification('err', 'Data Compliance Failure: Record not found in Manifest. You must manually provide PIR, Passenger Name, Flight Number, Destination, and at least one Tag number.');
        return;
      }
    }

    try {
      const response = await fetch('/api/baggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_bag',
          rawTag: scanTagInput,
          locationId: scanLocationId,
          status: scanStatus,
          reason: scanReason,
          agentId: operatorId,
          dispoType,
          dispoValue,
          dispoRemarks,
          pir: scanPir,
          passenger_name: scanPassengerName,
          original_tag: scanOriginalTag,
          rush_tag: scanRushTag,
          flight_no: scanFlightNo,
          seal_no: scanSealNo,
          destination: scanDestination,
          remarks: scanRemarks
        })
      });

      const json = await response.json();
      if (json.success) {
        triggerNotification('success', `Scanned bag tag ${json.baggage_item.alpha_tag} successfully registers equivalent standard ${json.baggage_item.universal_tag}.`);
        setScanTagInput(''); // reset
        setDispoType('');
        setDispoValue('');
        setDispoRemarks('');
        
        // Reset manifest inputs
        setScanPir('');
        setScanPassengerName('');
        setScanOriginalTag('');
        setScanRushTag('');
        setScanFlightNo('');
        setScanSealNo('');
        setScanDestination('');
        setScanRemarks('');

        setIsManifestMatched(false);
        setLastCheckedTag('');
        
        loadData(true);
      } else {
        triggerNotification('err', json.error || 'Failed registering scanned tag.');
      }
    } catch (err) {
      triggerNotification('err', 'Network error during baggage scan registration.');
    }
  };

  // 2. Add New Dynamic Location
  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    try {
      setIsCreatingLoc(true);
      const response = await fetch('/api/baggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_location',
          name: newLocName,
          type: newLocType
        })
      });

      const json = await response.json();
      if (json.success) {
        triggerNotification('success', `Dynamic location "${newLocName}" of type ${newLocType} is active in registry.`);
        setNewLocName('');
        loadData(true);
      } else {
        triggerNotification('err', json.error || 'Failed creating new regulatory spot.');
      }
    } catch (err) {
      triggerNotification('err', 'Network error creating storage location.');
    } finally {
      setIsCreatingLoc(false);
    }
  };

  // 3. Amend registered bag (Edit)
  const handleAmendBag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBag) return;

    const mergedReason = amendReason === 'Other (provide comment)' ? customAmendReason : amendReason;
    if (!mergedReason.trim()) {
      triggerNotification('err', 'Please specify a mandatory compliance reason.');
      return;
    }

    try {
      const response = await fetch('/api/baggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_bag',
          bagId: editingBag.id,
          locationId: amendLocationId,
          status: amendStatus,
          reason: mergedReason,
          agentId: operatorId,
          dispoType: amendDispoType,
          dispoValue: amendDispoValue,
          dispoRemarks: amendDispoRemarks,
          pir: amendPir,
          passenger_name: amendPassengerName,
          original_tag: amendOriginalTag,
          rush_tag: amendRushTag,
          flight_no: amendFlightNo,
          seal_no: amendSealNo,
          destination: amendDestination,
          remarks: amendRemarks
        })
      });

      const json = await response.json();
      if (json.success) {
        triggerNotification('success', `Baggage tag ${editingBag.alpha_tag} location corrected safely. Audit trail entry archived.`);
        setEditingBag(null);
        setCustomAmendReason('');
        loadData(true);
      } else {
        triggerNotification('err', json.error || 'Error amending baggage tag.');
      }
    } catch (err) {
      triggerNotification('err', 'Network fault patching baggage state entries.');
    }
  };

  // 4. Soft-delete registered bag with reason code
  const handleDeleteBag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingBag) return;

    const mergedReason = deleteReason === 'Other (provide comment)' ? customDeleteReason : deleteReason;
    if (!mergedReason.trim()) {
      triggerNotification('err', 'Compliance deletes require audit comments.');
      return;
    }

    try {
      const response = await fetch('/api/baggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_bag',
          bagId: deletingBag.id,
          reason: mergedReason,
          agentId: operatorId
        })
      });

      const json = await response.json();
      if (json.success) {
        triggerNotification('success', `Baggage record ${deletingBag.alpha_tag} soft-deleted. Audit Trail logs updated.`);
        setDeletingBag(null);
        setCustomDeleteReason('');
        loadData(true);
      } else {
        triggerNotification('err', json.error || 'Deletion request failed.');
      }
    } catch (err) {
      triggerNotification('err', 'Network fault sending deletion commands.');
    }
  };

  // Admin & Data management handlers
  const handleAdminSignout = () => {
    setIsAdmin(false);
    triggerNotification('success', 'Logged out from System Administrator mode.');
  };

  const handleAdminSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    if (adminUsername === 'admin' && adminPassword === 'Admin220!') {
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminUsername('');
      setAdminPassword('');
      triggerNotification('success', 'Logged in as System Administrator successfully.');
    } else {
      setAdminError('Invalid admin username or password sequence.');
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      triggerNotification('err', 'Admin access required to create delivery agents.');
      return;
    }
    if (!newAgentName.trim()) return;

    try {
      setIsCreatingAgent(true);
      const response = await fetch('/api/baggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_delivery_agent',
          name: newAgentName
        })
      });

      const json = await response.json();
      if (json.success) {
        triggerNotification('success', `Delivery Agent "${newAgentName}" is active in registry.`);
        setNewAgentName('');
        loadData(true);
      } else {
        triggerNotification('err', json.error || 'Failed to register delivery agent.');
      }
    } catch (err) {
      triggerNotification('err', 'Network error registering delivery agent.');
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!isAdmin) {
      triggerNotification('err', 'Admin access required to delete delivery agents.');
      return;
    }

    setCustomConfirmState({
      isOpen: true,
      title: 'Remove Delivery Agent',
      message: 'Are you sure you want to delete this delivery agent from the database? This is an irreversible registry change.',
      confirmText: 'Confirm Deletion',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/baggage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete_delivery_agent',
              agentId
            })
          });

          const json = await response.json();
          if (json.success) {
            triggerNotification('success', 'Delivery agent removed.');
            loadData(true);
          } else {
            triggerNotification('err', json.error || 'Failed to remove delivery agent.');
          }
        } catch (err) {
          triggerNotification('err', 'Network error deleting delivery agent.');
        } finally {
          setCustomConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!isAdmin) {
      triggerNotification('err', 'Admin access required to delete location slots.');
      return;
    }

    setCustomConfirmState({
      isOpen: true,
      title: 'Remove Location Slot',
      message: 'Are you sure you want to delete this location slot? This will affect tracking registries assigned here.',
      confirmText: 'Confirm Deletion',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/baggage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete_location',
              locationId
            })
          });

          const json = await response.json();
          if (json.success) {
            triggerNotification('success', 'Location slot deleted.');
            loadData(true);
          } else {
            triggerNotification('err', json.error || 'Failed to delete location slot.');
          }
        } catch (err) {
          triggerNotification('err', 'Network error deleting location slot.');
        } finally {
          setCustomConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handlePurgeBag = async (bag: BaggageItem) => {
    if (!isAdmin) {
      triggerNotification('err', 'System Admin access is required to purge records.');
      return;
    }

    setCustomConfirmState({
      isOpen: true,
      title: 'Expunge Passenger Entry',
      message: `Are you absolutely sure you want to PHYSICALLY purge the passenger record for tag ${bag.alpha_tag} (${bag.universal_tag}) from active databases? This action is irreversible for security compliance.`,
      confirmText: 'Expunge & Purge',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/baggage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'purge_bag',
              bagId: bag.id,
              agentId: operatorId
            })
          });

          const json = await response.json();
          if (json.success) {
            triggerNotification('success', `Passenger records for standard IATA tag ${bag.alpha_tag} completely purged.`);
            setDeletingBag(null);
            loadData(true);
          } else {
            triggerNotification('err', json.error || 'Failed to purge database records.');
          }
        } catch (err) {
          triggerNotification('err', 'Network fault sending purge commands.');
        } finally {
          setCustomConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Helper to parse multi-field CSV or raw text table into structured manifest rows
  const parseCSVToRows = (text: string): any[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    
    // Check if first line is a header by detecting typical manifestation field names
    const isHeader = headers.some(h => 
      h.includes('tag') || 
      h.includes('pir') || 
      h.includes('passenger') || 
      h.includes('name') || 
      h.includes('rush') || 
      h.includes('flight') || 
      h.includes('seal') || 
      h.includes('destination') || 
      h.includes('remark')
    );

    let dataLines = lines;
    let colMap: { [key: string]: number } = {};

    if (isHeader) {
      dataLines = lines.slice(1);
      headers.forEach((h, index) => {
        if (h.includes('pir')) colMap['pir'] = index;
        else if (h.includes('name') || h.includes('passenger')) colMap['passenger_name'] = index;
        else if (h.includes('rushtag') || h.includes('rush')) colMap['rush_tag'] = index;
        else if (h.includes('originaltag') || h.includes('origtag') || h.includes('tag') || h.includes('bag')) {
          if (colMap['original_tag'] === undefined) colMap['original_tag'] = index;
        }
        else if (h.includes('flightno') || h.includes('flight') || h.includes('flt')) colMap['flight_no'] = index;
        else if (h.includes('sealno') || h.includes('seal')) colMap['seal_no'] = index;
        else if (h.includes('destination') || h.includes('dest') || h.includes('apt')) colMap['destination'] = index;
        else if (h.includes('remark') || h.includes('comment') || h.includes('note')) colMap['remarks'] = index;
      });
    }

    const results = dataLines.map((line, rowIndex) => {
      const parts = parseCSVLine(line);
      
      let original_tag = '';
      let pir = '';
      let passenger_name = '';
      let rush_tag = '';
      let flight_no = '';
      let seal_no = '';
      let destination = '';
      let remarks = '';

      if (isHeader && Object.keys(colMap).length > 0) {
        if (colMap['original_tag'] !== undefined && parts[colMap['original_tag']]) original_tag = parts[colMap['original_tag']].trim();
        if (colMap['pir'] !== undefined && parts[colMap['pir']]) pir = parts[colMap['pir']].trim();
        if (colMap['passenger_name'] !== undefined && parts[colMap['passenger_name']]) passenger_name = parts[colMap['passenger_name']].trim();
        if (colMap['rush_tag'] !== undefined && parts[colMap['rush_tag']]) rush_tag = parts[colMap['rush_tag']].trim();
        if (colMap['flight_no'] !== undefined && parts[colMap['flight_no']]) flight_no = parts[colMap['flight_no']].trim();
        if (colMap['seal_no'] !== undefined && parts[colMap['seal_no']]) seal_no = parts[colMap['seal_no']].trim();
        if (colMap['destination'] !== undefined && parts[colMap['destination']]) destination = parts[colMap['destination']].trim();
        if (colMap['remarks'] !== undefined && parts[colMap['remarks']]) remarks = parts[colMap['remarks']].trim();
      } else {
        // Sequentially match up columns if no headers are found but multiple values exist
        if (parts.length >= 3) {
          // Assume layout: PIR, Name, Tag, [RushTag, FlightNo, SealNo, Destination, Remarks]
          pir = parts[0] ? parts[0].trim() : '';
          passenger_name = parts[1] ? parts[1].trim() : '';
          original_tag = parts[2] ? parts[2].trim() : '';
          rush_tag = parts[3] ? parts[3].trim() : '';
          flight_no = parts[4] ? parts[4].trim() : '';
          seal_no = parts[5] ? parts[5].trim() : '';
          destination = parts[6] ? parts[6].trim() : '';
          remarks = parts[7] ? parts[7].trim() : '';
        } else {
          // Single element tag
          original_tag = parts[0] ? parts[0].trim() : '';
        }
      }

      // If original tag is missing but we have parts, use the first element
      if (!original_tag && parts[0]) {
        original_tag = parts[0].trim();
      }

      return {
        id: `row-${Date.now()}-${rowIndex}`,
        pir: pir || `PIR-LH-${88000 + rowIndex}`,
        passenger_name: passenger_name || `Pax Holder ${rowIndex + 1}`,
        original_tag: original_tag || `0220${100000 + rowIndex}`,
        rush_tag: rush_tag || '',
        flight_no: flight_no || manifestFlightInput || '',
        seal_no: seal_no || `S-${700 + rowIndex}`,
        destination: destination || 'FRA',
        remarks: remarks || 'Awaiting Ground Check'
      };
    });

    return results.filter(r => r.original_tag);
  };

  const exportForBDO = () => {
    if (filteredBaggage.length === 0) {
      triggerNotification('err', 'No data to export.');
      return;
    }

    setIsExportingBDO(true);
    try {
      const data = filteredBaggage.map(bag => {
        const agent = deliveryAgents.find(a => a.id === bag.dispo_value);
        return {
          'PIR': bag.pir,
          'Passenger Name': bag.passenger_name,
          'Universal Tag': bag.universal_tag,
          'Alpha Tag': bag.alpha_tag,
          'Original Tag': bag.original_tag,
          'Rush Tag': bag.rush_tag,
          'Flight No': bag.flight_no,
          'Destination': bag.destination,
          'Carrier': bag.airline_name,
          'Seal No': bag.seal_no,
          'Status': bag.status,
          'Delivery Agent': agent ? agent.agent_name : (bag.dispo_type === 'Delivery Agent' ? bag.dispo_value : 'N/A'),
          'Location': locations.find(l => l.id === bag.current_location_id)?.location_name || 'N/A',
          'Updated At': new Date(bag.updated_at || Date.now()).toLocaleString(),
          'Remarks': bag.remarks
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'BDO_SBSC_Export');
      XLSX.writeFile(workbook, `BDO_SBSC_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      triggerNotification('success', 'BDO List exported successfully for S-BSC.');
    } catch (err) {
      triggerNotification('err', 'Failed to generate BDO export.');
    } finally {
      setIsExportingBDO(false);
    }
  };

  // 5. Upload flight manifest (XLSX / CSV parser)
  const handleManifestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manifestFlightInput.trim()) {
      triggerNotification('err', 'Please enter a valid Flight Number (e.g. Flight No).');
      return;
    }

    let rowsToSend: any[] = [];
    if (parsedManifestRows && parsedManifestRows.length > 0) {
      rowsToSend = parsedManifestRows;
    } else if (rawManifestPaste.trim()) {
      rowsToSend = parseCSVToRows(rawManifestPaste);
    }

    if (rowsToSend.length === 0) {
      triggerNotification('err', 'No luggage identification labels detected. Paste columns or import a file first.');
      return;
    }

    try {
      const response = await fetch('/api/baggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload_manifest',
          flightNumber: manifestFlightInput.toUpperCase(),
          rows: rowsToSend
        })
      });

      const json = await response.json();
      if (json.success) {
        let msg = '';
        const { totalRecords, uploadedRecords, duplicatesRejected } = json;
        
        if (duplicatesRejected === 0) {
          msg = `${uploadedRecords} records uploaded successfully for flight ${manifestFlightInput}.`;
        } else if (uploadedRecords === 0) {
          msg = `All ${totalRecords} records were duplicates; none were uploaded for flight ${manifestFlightInput}.`;
        } else {
          msg = `Of ${totalRecords} records, ${duplicatesRejected} were duplicate which are ignored and remaining ${uploadedRecords} uploaded for flight ${manifestFlightInput}.`;
        }
        
        triggerNotification('success', msg);
        setManifestFlightInput('');
        setRawManifestPaste('');
        setParsedManifestRows(null);
        setSelectedManifestId(json.manifest.id);
        loadData(true);
      } else {
        triggerNotification('err', json.error || 'Invalid flight manifest database structure.');
      }
    } catch (err) {
      triggerNotification('err', 'Server failure compiling airline flight manifest.');
    }
  };

  // Easy simulation loader for manifests
  const loadDemoManifestStr = () => {
    setManifestFlightInput('LX 146');
    const demoCsv = "PIR,Passenger Name,Original Tag,Rush Tag,Flight No,Seal No,Destination,Remarks\n" +
                    "PIR-LX-88201,John Doe,0220123456,,LX 146,S-712,ZRH,Priority First Class\n" +
                    "PIR-LX-88202,Alice Smith,UA 112233,LX 900501,LX 146,S-713,GVA,Shortshipped Active Case\n" +
                    "PIR-LX-88203,Robert Johnson,0016456789,,LX 146,S-714,ZRH,Hold baggage Cabin item\n" +
                    "PIR-LX-88204,Emily Brown,UA 990011,,LX 146,S-715,ZRH,Fragile Sports Eq\n" +
                    "PIR-LX-88205,Michael Davis,DL 789012,LX 900502,LX 146,S-716,GVA,Customs refusal flag";
    
    setRawManifestPaste(demoCsv);
    const parsed = parseCSVToRows(demoCsv);
    setParsedManifestRows(parsed);
  };

  // CSV Drag and drop or manual file parsing handler
  const handleManifestCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target?.result;
        if (data) {
          try {
            const arr = new Uint8Array(data as ArrayBuffer);
            const workbook = XLSX.read(arr, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const csvText = XLSX.utils.sheet_to_csv(sheet);
            
            const parsed = parseCSVToRows(csvText);
            if (parsed.length > 0) {
              setRawManifestPaste(csvText);
              setParsedManifestRows(parsed);
              
              const fileFlights = parsed.map(p => p.flight_no).filter(Boolean);
              const flightGuess = fileFlights[0] || file.name.replace(/\.[^/.]+$/, "").substring(0, 10).toUpperCase();
              setManifestFlightInput(flightGuess);
              triggerNotification('success', `Successfully parsed Excel sheet "${sheetName}" from ${file.name}. Extracted ${parsed.length} detail-rich baggage records!`);
            } else {
              triggerNotification('err', 'Could not locate any valid baggage records in this Excel sheet.');
            }
          } catch (err: any) {
            console.error("Excel parse error:", err);
            triggerNotification('err', `Failed to parse Excel file: ${err.message || err}`);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) {
          const parsed = parseCSVToRows(text);
          if (parsed.length > 0) {
            setRawManifestPaste(text);
            setParsedManifestRows(parsed);
            
            const fileFlights = parsed.map(p => p.flight_no).filter(Boolean);
            const flightGuess = fileFlights[0] || file.name.replace(/\.[^/.]+$/, "").substring(0, 10).toUpperCase();
            setManifestFlightInput(flightGuess);
            triggerNotification('success', `Extracted ${parsed.length} detail-rich baggage records from ${file.name}. Review below and compile!`);
          } else {
            triggerNotification('err', 'Could not locate any valid bags in CSV file.');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  // Database Reset to standard state
  const handleResetDatabase = async () => {
    setCustomConfirmState({
      isOpen: true,
      title: 'Reset FAA Dataset',
      message: 'This will reset all baggage records, location slots, delivery agents, and audit trails to the initial factory-default dataset. Do you want to proceed?',
      confirmText: 'Reset Registry',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/baggage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_database' })
          });
          const json = await response.json();
          if (json.success) {
            triggerNotification('success', 'Regulatory aviation records successfully restored.');
            loadData();
          }
        } catch (err) {
          triggerNotification('err', 'Communication failure during system reset.');
        } finally {
          setCustomConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Update operator identity handler
  const saveOperator = () => {
    if (operatorInput.trim()) {
      setOperatorId(operatorInput.trim());
      setIsEditingOperator(false);
      triggerNotification('success', `Operator identity changed to: ${operatorInput.trim()}`);
    }
  };

  // Pre-load barcode testing button generators
  const runSimulatedScan = (tag: string, locationId: string, status: string = 'Scanned') => {
    setScanTagInput(tag);
    if (locationId) setScanLocationId(locationId);
    setScanStatus(status);
    setActiveTab('register');
    
    // Smooth scroll to register zone
    const scanZone = document.getElementById('scan-control-focus');
    if (scanZone) {
      scanZone.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ----------------------------------------------------
  // MANIFEST ROW MANAGEMENT
  // ----------------------------------------------------
  const toggleRowSelection = (id: string) => {
    setSelectedManifestRowIds(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };

  const toggleAllRows = (rows: ManifestRow[]) => {
    if (selectedManifestRowIds.length === rows.length) {
      setSelectedManifestRowIds([]);
    } else {
      setSelectedManifestRowIds(rows.map(r => r.id));
    }
  };

  const handleDeleteManifestRows = async (ids: string[]) => {
    setCustomConfirmState({
      isOpen: true,
      title: ids.length > 1 ? 'Delete Multiple Records' : 'Delete Manifest Record',
      message: `Are you sure you want to permanently delete ${ids.length > 1 ? ids.length + ' records' : 'this record'} from the live flight manifest? This action is irreversible.`,
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        try {
          // Send request for each manifest
          const rowsToDelete = reconciliationRows.filter(r => ids.includes(r.id));
          const byManifest: Record<string, string[]> = {};
          rowsToDelete.forEach(r => {
            if (!byManifest[r.manifestId]) byManifest[r.manifestId] = [];
            byManifest[r.manifestId].push(r.id);
          });
          
          let successCount = 0;
          for (const mId of Object.keys(byManifest)) {
            const response = await fetch('/api/baggage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'delete_manifest_rows',
                manifestId: mId,
                rowIds: byManifest[mId]
              })
            });
            const json = await response.json();
            if (json.success) successCount += byManifest[mId].length;
          }

          if (successCount > 0) {
            triggerNotification('success', `${successCount} ${successCount > 1 ? 'records' : 'record'} deleted successfully.`);
            setSelectedManifestRowIds(prev => prev.filter(id => !ids.includes(id)));
            loadData(true);
          } else {
             triggerNotification('err', 'Failed to delete records.');
          }
        } catch (err) {
          triggerNotification('err', 'Network error while deleting records.');
        } finally {
          setCustomConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const startEditingManifestRow = (row: any) => {
    setEditingManifestRow(row);
    setManifestRowEditForm({ ...row });
  };

  const handleUpdateManifestRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingManifestRow) return;
    
    // Fallback to selected if manifestId missing on row fallback
    const targetManifestId = editingManifestRow.manifestId || selectedManifestId;

    if (!targetManifestId) {
      triggerNotification('err', 'System Error: No active flight manifest selected.');
      return;
    }

    setIsUpdatingManifestRow(true);
    try {
      const response = await fetch('/api/baggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_manifest_row',
          manifestId: targetManifestId,
          row: manifestRowEditForm
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error occurred');
      }

      const json = await response.json();
      if (json.success) {
        triggerNotification('success', 'Manifest record updated successfully.');
        setEditingManifestRow(null);
        await loadData(true);
      } else {
        triggerNotification('err', json.error || 'Failed to update record.');
      }
    } catch (err: any) {
      triggerNotification('err', err.message || 'Network error while updating record.');
    } finally {
      setIsUpdatingManifestRow(false);
    }
  };

  const handleBatchDispoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchLocationId) {
      triggerNotification('err', 'System Error: You must select a Target Disposition Slot before processing batch tags.');
      return;
    }
    const tags = batchTagsInput.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
    if (tags.length === 0) {
      triggerNotification('err', 'Input Error: No baggage tags detected in input field.');
      return;
    }

    setIsProcessingBatch(true);
    try {
      const response = await fetch('/api/baggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_dispo',
          locationId: batchLocationId,
          tags: tags,
          agentId: operatorId
        })
      });
      const json = await response.json();
      if (json.success) {
        const successCount = json.results.filter((r: any) => r.status === 'Success').length;
        const errCount = json.results.filter((r: any) => r.status === 'Error').length;
        
        if (errCount === 0) {
          let targetDisplay = locations.find(l => l.id === batchLocationId)?.location_name;
          if (!targetDisplay && batchLocationId.startsWith('agent:')) {
            const agentId = batchLocationId.split(':')[1];
            targetDisplay = deliveryAgents.find(a => a.id === agentId)?.agent_name;
          }
          if (!targetDisplay && batchLocationId.startsWith('type:')) {
            targetDisplay = batchLocationId.split(':')[1];
          }

          triggerNotification('success', `Batch Complete: ${successCount} tags successfully allocated to ${targetDisplay || 'target'}.`);
          setBatchTagsInput('');
        } else {
          triggerNotification('success', `Batch Partially Complete: ${successCount} successful, ${errCount} failures recorded. See console for details.`);
          console.table(json.results);
        }
        loadData(true);
      } else {
        triggerNotification('err', json.error || 'Batch disposition failed.');
      }
    } catch (err) {
      triggerNotification('err', 'Network Protocol Error during batch processing.');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const saveAllowedFlights = async () => {
    setIsProcessingFlights(true);
    try {
      const flights = newFlightsInput.split(',').map(f => f.trim()).filter(f => f.length > 0);
      const response = await fetch('/api/baggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_allowed_flights', flights })
      });
      const json = await response.json();
      if (json.success) {
        triggerNotification('success', 'Flight filter options updated.');
        loadData(true);
      } else {
        triggerNotification('err', json.error || 'Failed to update flights.');
      }
    } catch (err) {
      triggerNotification('err', 'Network error.');
    } finally {
      setIsProcessingFlights(false);
    }
  };

  // ----------------------------------------------------
  // FILTERING LOGIC
  // ----------------------------------------------------
  const filteredBaggage = baggageItems.filter(bag => {
    // 1. Title/Tag Search Match
    const matchesSearch = searchQuery.trim() === '' || 
      bag.universal_tag.includes(searchQuery) ||
      bag.alpha_tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bag.airline_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bag.serial_number.includes(searchQuery);

    // 2. Dynamic Location Match
    const matchesLocation = filterLocationId === 'all' || bag.current_location_id === filterLocationId;

    // 3. Status Match
    const matchesStatus = filterStatus === 'all' || bag.status === filterStatus;

    // 4. Dynamic Carrier / Prefix Match
    const matchesCarrier = filterCarrier === 'all' || 
      bag.airline_name.toLowerCase().replace(/\s+/g, '') === filterCarrier.toLowerCase().replace(/\s+/g, '') ||
      bag.alpha_tag.toUpperCase().startsWith(filterCarrier.toUpperCase());

    // 5. Flight Match
    const matchesFlight = filterFlight === 'all' || 
      (bag.flight_no && bag.flight_no.toUpperCase().includes(filterFlight.toUpperCase()));

    // 6. Delivery Agent Database Match
    const matchesAgent = filterAgents.includes('all') || 
      (bag.dispo_type === 'Delivery Agent' && bag.dispo_value && filterAgents.includes(bag.dispo_value));

    return matchesSearch && matchesLocation && matchesStatus && matchesCarrier && matchesFlight && matchesAgent;
  });

  // Extract list of unique carriers for drop-downs
  const dynamicCarriers = Array.from(new Set(baggageItems.map(b => b.airline_name))).filter(Boolean);

  // ----------------------------------------------------
  // ECO CONTRAL RECONCILIATION SUMMARY
  // ----------------------------------------------------
  const matchedScannedBags: BaggageItem[] = [];
  const missingBagsFromManifest: { originalTag: string; parsedInfo: any }[] = [];

  manifests.forEach(m => {
    m.expected_tags.forEach(expectedUniversalTag => {
      // Find matching in scanned registry based on universal code equivalency!
      const found = baggageItems.find(scanned => scanned.universal_tag === expectedUniversalTag);
      if (found) {
        if (!matchedScannedBags.some(b => b.id === found.id)) {
          matchedScannedBags.push(found);
        }
      } else {
        if (!missingBagsFromManifest.some(missing => missing.originalTag === expectedUniversalTag)) {
          // Try parsing to give user nice feedback
          const parsedExpected = parseBagTag(expectedUniversalTag);
          missingBagsFromManifest.push({
            originalTag: expectedUniversalTag,
            parsedInfo: parsedExpected
          });
        }
      }
    });
  });

  // Handle Automatic Manifest Matching during Registration (Moved here to ensure manifestData is in scope)
  useEffect(() => {
    const trimmed = scanTagInput.trim();
    if (!trimmed || manifests.length === 0) {
      if (isManifestMatched) setIsManifestMatched(false);
      return;
    }
    
    // Only check if we haven't checked this tag/manifest combo recently
    const checkKey = trimmed;
    if (checkKey === lastCheckedTag) return;
    
    const parsed = parseBagTag(trimmed);
    if (!parsed) return;
    
    const target = parsed.universalTag;
    let matchedRow: any = null;
    
    for (const m of manifests) {
      if (m.rows) {
        matchedRow = m.rows.find(row => {
          const rowOrig = row.original_tag ? parseBagTag(row.original_tag)?.universalTag : null;
          const rowRush = row.rush_tag ? parseBagTag(row.rush_tag)?.universalTag : null;
          return rowOrig === target || rowRush === target;
        });
        if (matchedRow) break;
      }
    }

    if (matchedRow) {
      setIsManifestMatched(true);
      setLastCheckedTag(checkKey);
      
      // Auto-fill
      setScanPir(matchedRow.pir || '');
      setScanPassengerName(matchedRow.passenger_name || '');
      setScanOriginalTag(matchedRow.original_tag || '');
      setScanRushTag(matchedRow.rush_tag || '');
      setScanFlightNo(matchedRow.flight_no || '');
      setScanSealNo(matchedRow.seal_no || '');
      setScanDestination(matchedRow.destination || '');
      setScanRemarks(matchedRow.remarks || '');
      
      triggerNotification('success', `Manifest Identity Verified: ${matchedRow.passenger_name} (${matchedRow.original_tag || matchedRow.rush_tag}) matched successfully.`);
    } else {
      // If we looked it up and found nothing (only notify if tag looks complete)
      if (trimmed.length >= 8 && checkKey !== lastCheckedTag) {
        setLastCheckedTag(checkKey);
        triggerNotification('err', 'Alert: No matching identity found in Live Flight Manifest. Manual record declaration mandatory.');
      }
      setIsManifestMatched(false);
    }
  }, [scanTagInput, manifests, lastCheckedTag, isManifestMatched, triggerNotification]);

  const totalExpected = manifests.reduce((sum, m) => sum + m.expected_tags.length, 0);
  const reconciliationPercent = manifests.length > 0 && totalExpected > 0
    ? Math.round((matchedScannedBags.length / totalExpected) * 100)
    : 0;

  const reconciliationRows = manifests.flatMap(m => {
    const attachManifestId = (r: any) => ({ ...r, manifestId: m.id });
    return m.rows && m.rows.length > 0
      ? m.rows.map(attachManifestId)
      : m.expected_tags.map((tag, idx) => {
          const parsed = parseBagTag(tag);
          return attachManifestId({
            id: `row-fallback-${idx}-${m.id}`,
            pir: `PIR-${m.airline_code || 'XX'}-${88200 + idx}`,
            passenger_name: `Passenger Box ${idx + 1}`,
            original_tag: tag,
            rush_tag: '',
            flight_no: m.flight_number,
            seal_no: `S-71${idx}`,
            destination: 'FRA',
            remarks: 'Simple tag import list'
          });
        });
  });

  const filteredReconciliationRows = reconciliationRows;

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-slate-50 pb-12">
      {/* 
        RUSH BAG WIZARD Header Area
      */}
      <header className="border-b border-slate-200 bg-white backdrop-blur sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <Image 
                src={logo} 
                alt="RUSH BAG WIZARD Logo" 
                fill 
                className="object-cover"
              />
            </div>
            <div>
              <span className="font-mono text-[10px] tracking-widest text-slate-500 uppercase font-bold">Priority Expedit Hub</span>
              <h1 className="text-xl font-bold font-display tracking-tight text-slate-900 flex items-center gap-2">
                RUSH BAG WIZARD <span className="text-xs bg-red-100 border border-red-200 text-red-600 font-mono py-0.5 px-2 rounded-full">v2.1 Priority</span>
              </h1>
            </div>
          </div>

          {/* Compliance Logged User (Operator ID & Admin Context) */}
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            {/* Admin status toggle */}
            {isAdmin ? (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-2 px-3 text-xs font-semibold shadow-xs">
                <Lock className="h-4 w-4 text-rose-600 animate-pulse" />
                <div className="text-left font-mono">
                  <span className="block text-[8px] text-rose-500 uppercase tracking-wider font-bold">Security Context</span>
                  <span className="text-[10px] font-bold text-rose-900">Admin Active</span>
                </div>
                <button 
                  onClick={handleAdminSignout}
                  className="ml-2 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] uppercase font-bold py-1 px-2 rounded-lg transition"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAdminModal(true)}
                className="bg-slate-800 hover:bg-slate-900 border border-slate-700 hover:border-slate-800 text-white text-xs font-bold py-2 px-3 rounded-xl cursor-pointer transition shadow-xs flex items-center gap-1.5"
              >
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Admin Sign-In
              </button>
            )}

            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2 px-3 shadow-xs">
              <User className="h-4 w-4 text-slate-500" />
              <div className="text-left font-mono">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Active Scrutineer</span>
                {isEditingOperator ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="email"
                      value={operatorInput}
                      onChange={(e) => setOperatorInput(e.target.value)}
                      className="bg-white font-mono text-xs border border-blue-500 rounded px-1.5 py-0.5 text-slate-900 w-48 focus:outline-none"
                      placeholder="operator@aviation.com"
                    />
                    <button 
                      onClick={saveOperator}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-0.5 px-2 font-bold rounded shadow-xs"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-800 font-semibold">{operatorId}</span>
                    <button
                      onClick={() => {
                        setOperatorInput(operatorId);
                        setIsEditingOperator(true);
                      }}
                      className="text-[10px] text-blue-600 hover:underline hover:text-blue-700 font-bold"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* System Toast / Api Messages */}
      <AnimatePresence>
        {apiError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 w-full z-[100] bg-red-50 border-b border-red-200 text-red-800 px-4 py-3.5 text-center text-sm font-semibold flex items-center justify-center gap-2 shadow-xs"
          >
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{apiError}</span>
          </motion.div>
        )}
        {apiSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 w-full z-[100] bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-4 py-3.5 text-center text-sm font-semibold flex items-center justify-center gap-2 shadow-xs"
          >
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{apiSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 flex-grow w-full">
        {/* Navigation Tabs */}
        <div className="flex border border-slate-200 bg-white/90 backdrop-blur rounded-2xl p-2 gap-1 overflow-x-auto pb-2 md:pb-2 shadow-sm">
          <button
            onClick={() => setActiveTab('reconcile')}
            className={`py-2.5 px-4 font-display font-medium text-sm transition duration-150 shrink-0 flex items-center gap-2 rounded-xl cursor-pointer ${
              activeTab === 'reconcile' 
                ? 'bg-blue-600 text-white font-semibold shadow-xs' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Flight Manifest Verification
            {manifests.length > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                activeTab === 'reconcile' 
                  ? 'bg-blue-700 text-white' 
                  : reconciliationPercent === 100 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {totalExpected} Tags / {reconciliationPercent}%
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`py-2.5 px-4 font-display font-medium text-sm transition duration-150 shrink-0 flex items-center gap-2 rounded-xl cursor-pointer ${
              activeTab === 'register' 
                ? 'bg-blue-600 text-white font-semibold shadow-xs' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ScanLine className="h-4 w-4" />
            Tag Scanner & Registry Manual
          </button>
          <button
            onClick={() => setActiveTab('batch-dispo')}
            className={`py-2.5 px-4 font-display font-medium text-sm transition duration-150 shrink-0 flex items-center gap-2 rounded-xl cursor-pointer ${
              activeTab === 'batch-dispo' 
                ? 'bg-blue-600 text-white font-semibold shadow-xs' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Layers className="h-4 w-4" />
            Batch Dispo
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`py-2.5 px-4 font-display font-medium text-sm transition duration-150 shrink-0 flex items-center gap-2 rounded-xl cursor-pointer ${
              activeTab === 'search' 
                ? 'bg-blue-600 text-white font-semibold shadow-xs' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Search className="h-4 w-4" />
            Reconciliation Registry Search
            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${activeTab === 'search' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
              {filteredBaggage.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2.5 px-4 font-display font-medium text-sm transition duration-150 shrink-0 flex items-center gap-2 rounded-xl cursor-pointer ${
              activeTab === 'logs' 
                ? 'bg-blue-600 text-white font-semibold shadow-xs' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Activity className="h-4 w-4" />
            Aviation Audit Logs
            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${activeTab === 'logs' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
              {auditLogs.length}
            </span>
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="mt-6 md:grid md:grid-cols-12 md:gap-6">
          
          {/* TAB 1: SCANNER & REGISTRATION ENGINE */}
          {activeTab === 'register' && (
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Scan baggage Form */}
              <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" id="scan-control-focus">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ScanLine className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Manual Tag Entry & Simulation</h2>
                  </div>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono tracking-wider uppercase font-bold">IATA Standard Compliant</span>
                </div>

                <form onSubmit={handleRegisterBag} className="space-y-4">
                  {/* Tag Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Baggage License Tag Number
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={scanTagInput}
                          onChange={(e) => setScanTagInput(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-900 font-mono text-base tracking-widest rounded-xl p-3 px-4 focus:outline-none placeholder-slate-400 focus:ring-1 focus:ring-blue-500/10"
                          placeholder="e.g. 0220123456 or LH 123456"
                          required
                          autoFocus
                        />
                        {scanTagInput && (
                          <button
                            type="button"
                            onClick={() => setScanTagInput('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-xs font-mono px-2 py-0.5 rounded border border-slate-205 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => startCameraScan('environment')}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 rounded-xl text-xs transition cursor-pointer shadow-xs whitespace-nowrap"
                        title="Scan tag with camera"
                      >
                        <Camera className="h-4 w-4" />
                        Scan Tag
                      </button>
                    </div>
                  </div>

                  {/* Real-time Validation Feedback & Equivalence Demonstration */}
                  <AnimatePresence>
                    {parsedFeedback && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-blue-50/40 border border-blue-100/70 rounded-xl p-3.5 space-y-2.5 overflow-hidden"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-bold font-mono uppercase tracking-wider">Equivalence Engine</span>
                          <span className="text-blue-700 font-bold font-mono bg-blue-100/50 px-2.5 py-0.5 rounded border border-blue-200/50">
                            Carrier: {parsedFeedback.airlineName}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center py-2 bg-white rounded-lg border border-blue-100/50">
                          <div className="p-1 px-2 border-r border-slate-100">
                            <span className="block text-[10px] text-slate-500 uppercase font-mono font-bold">10-Digit Barcode (Scanned)</span>
                            <span className="font-mono text-sm text-blue-600 tracking-wider font-bold">{parsedFeedback.universalTag}</span>
                          </div>
                          <div className="p-1 px-2">
                            <span className="block text-[10px] text-slate-500 uppercase font-mono font-bold">License Alphabetic Code</span>
                            <span className="font-mono text-sm text-indigo-600 tracking-wider font-bold">{parsedFeedback.alphaTag}</span>
                          </div>
                        </div>

                        {/* Note about compliance mapping */}
                        <div className="text-[10px] text-slate-600 flex items-start gap-1.5 leading-relaxed">
                          <HelpCircle className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <span>
                            Both formats resolve to the identical barcode identity in the registry database. Standard formatting mapped as: <code className="text-slate-800 bg-slate-100 border border-slate-200 px-1 rounded font-mono">0</code> (Leading-Code) + <code className="text-slate-800 bg-slate-100 border border-slate-200 px-1 rounded font-mono">{parsedFeedback.universalTag.substring(1, 4)}</code> (Numeric Carrier Code) + <code className="text-slate-800 bg-slate-100 border border-slate-200 px-1 rounded font-mono">{parsedFeedback.serialNumber}</code> (6-Digit Serial).
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Destination Location Dropdown (Dynamic) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Assigned Location Slot
                    </label>
                    <select
                      value={scanLocationId}
                      onChange={(e) => setScanLocationId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-700 rounded-xl p-3 focus:outline-none font-medium cursor-pointer"
                      required
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.location_name} ({loc.location_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Selection */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Operational Status
                      </label>
                      <select
                        value={scanStatus}
                        onChange={(e) => setScanStatus(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-3 focus:outline-none focus:bg-white focus:border-blue-500 font-medium cursor-pointer"
                      >
                        <option value="Scanned">Scanned (Standard)</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Customs Hold">Customs Hold</option>
                        <option value="Damaged">Damaged</option>
                        <option value="Left behind on Domestic transfer">Left behind on Domestic transfer</option>
                        <option value="Level 4">Level 4</option>
                        <option value="Marked Preventive">Marked Preventive</option>
                        <option value="Customs Refused">Customs Refused</option>
                        <option value="awaiting Pax Pickup">awaiting Pax Pickup</option>
                        <option value="Not traced">Not traced</option>
                        <option value="DID NOT ARRIVE">DID NOT ARRIVE</option>
                        <option value="For Delivery">For Delivery</option>
                        <option value="OAL Claim">OAL Claim</option>
                        <option value="DOM FWD">DOM FWD</option>
                        <option value="Hold">Hold</option>
                        <option value="Re-Export">Re-Export</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Log Action Reason / Comment
                      </label>
                      <input
                        type="text"
                        value={scanReason}
                        onChange={(e) => setScanReason(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-3 focus:outline-none focus:bg-white focus:border-blue-500 font-mono text-xs"
                        placeholder="Reason for register/move"
                      />
                    </div>
                  </div>

                  {/* BAGGAGE DISPO SECTION */}
                  <div className="border-t border-slate-100 pt-4 space-y-3.5">
                    <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs uppercase tracking-wider">
                      <Wrench className="h-4 w-4" />
                      <span>Baggage Dispo Options</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                          Disposition Type
                        </label>
                        <select
                          value={dispoType}
                          onChange={(e) => {
                            setDispoType(e.target.value as any);
                            setDispoValue('');
                          }}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-semibold cursor-pointer"
                        >
                          <option value="">-- No Disposition --</option>
                          <option value="Storage Location">Storage Location</option>
                          <option value="Delivery Agent">Delivery Agent</option>
                          <option value="Handover to OAL">Handover to OAL</option>
                          <option value="Domestic forward">Domestic forward</option>
                          <option value="DID NOT ARRIVE">DID NOT ARRIVE</option>
                        </select>
                      </div>

                      {/* Dynamic Value Input depending on type */}
                      {dispoType && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            {dispoType === 'Storage Location' && 'Select Storage Spot'}
                            {dispoType === 'Delivery Agent' && 'Select Agent'}
                            {dispoType === 'Handover to OAL' && 'OAL Airline Carrier'}
                            {dispoType === 'Domestic forward' && 'Domestic Forward Information'}
                            {dispoType === 'DID NOT ARRIVE' && 'Arrival Failure Status'}
                          </label>

                          {dispoType === 'Storage Location' ? (
                            <select
                              value={dispoValue}
                              onChange={(e) => setDispoValue(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-semibold cursor-pointer"
                              required
                            >
                              <option value="">-- Select Spot --</option>
                              {locations
                                .filter(loc => loc.location_type === 'Storage')
                                .map(loc => (
                                  <option key={loc.id} value={loc.location_name}>
                                    {loc.location_name}
                                  </option>
                                ))}
                            </select>
                          ) : dispoType === 'Delivery Agent' ? (
                            <select
                              value={dispoValue}
                              onChange={(e) => setDispoValue(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-semibold cursor-pointer"
                              required
                            >
                              <option value="">-- Select Agent --</option>
                              {deliveryAgents && deliveryAgents.length > 0 ? (
                                deliveryAgents.map(agent => (
                                  <option key={agent.id} value={agent.agent_name}>
                                    {agent.agent_name}
                                  </option>
                                ))
                              ) : (
                                <option value="DHL Courier">DHL Courier (Default)</option>
                              )}
                            </select>
                          ) : dispoType === 'Handover to OAL' ? (
                            <select
                              value={dispoValue}
                              onChange={(e) => setDispoValue(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-semibold cursor-pointer"
                              required
                            >
                              <option value="">-- Choose Host/Carrier --</option>
                              {Object.entries(AIRLINE_NAMES).map(([code, name]) => (
                                <option key={code} value={`${code} - ${name}`}>
                                  {code} - {name}
                                </option>
                              ))}
                              <option value="Star Alliance Partner">Star Alliance Partner</option>
                              <option value="OneWorld Carrier">OneWorld Carrier</option>
                              <option value="SkyTeam Host Carrier">SkyTeam Host Carrier</option>
                            </select>
                          ) : dispoType === 'Domestic forward' ? (
                            <input
                              type="text"
                              value={dispoValue}
                              onChange={(e) => setDispoValue(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 text-slate-800 rounded-xl p-2.5 px-3 focus:outline-none text-xs font-medium font-mono"
                              placeholder="Forward details (Free text)"
                              required
                            />
                          ) : (
                            <select
                              value={dispoValue}
                              onChange={(e) => setDispoValue(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-semibold cursor-pointer"
                              required
                            >
                              <option value="">-- Select State --</option>
                              <option value="Shortshipped / Left Behind">Shortshipped / Left Behind</option>
                              <option value="Misrouted Primary Hub">Misrouted Primary Hub</option>
                              <option value="Tracing Active Case">Tracing Active Case</option>
                            </select>
                          )}
                        </div>
                      )}
                    </div>

                    {dispoType && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                          Free Text Remarks
                        </label>
                        <textarea
                          rows={2}
                          value={dispoRemarks}
                          onChange={(e) => setDispoRemarks(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 text-slate-800 rounded-xl p-2.5 px-3 focus:outline-none text-xs"
                          placeholder="Provide custom remarks..."
                        />
                      </div>
                    )}
                  </div>

                  {/* Optional Flight Manifest Context Fields */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 mt-3 space-y-3">
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex justify-between items-center">
                      <span>Baggage Flight Manifest Context</span>
                      {isManifestMatched ? (
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Manifest Verified
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100 flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="h-3 w-3" />
                          Manual Declaration Mandatory
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex justify-between">
                          <span>PIR Number</span>
                          {!isManifestMatched && <span className="text-rose-500 font-bold">*</span>}
                        </label>
                        <input
                          type="text"
                          value={scanPir}
                          onChange={(e) => setScanPir(e.target.value)}
                          placeholder="e.g. PIR-LH-88201"
                          required={!isManifestMatched}
                          className={`w-full bg-white border ${!isManifestMatched && !scanPir ? 'border-rose-300' : 'border-slate-250'} rounded-lg p-2 focus:outline-none focus:border-blue-500 font-mono text-xs transition`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex justify-between">
                          <span>Passenger Name</span>
                          {!isManifestMatched && <span className="text-rose-500 font-bold">*</span>}
                        </label>
                        <input
                          type="text"
                          value={scanPassengerName}
                          onChange={(e) => setScanPassengerName(e.target.value)}
                          placeholder="Passenger Name"
                          required={!isManifestMatched}
                          className={`w-full bg-white border ${!isManifestMatched && !scanPassengerName ? 'border-rose-300' : 'border-slate-250'} rounded-lg p-2 focus:outline-none focus:border-blue-500 text-xs transition`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex justify-between">
                          <span>Original Tag No</span>
                          {!isManifestMatched && <span className="text-rose-500 font-bold">*</span>}
                        </label>
                        <input
                          type="text"
                          value={scanOriginalTag}
                          onChange={(e) => setScanOriginalTag(e.target.value)}
                          placeholder="e.g. 0220123456"
                          required={!isManifestMatched && !scanRushTag}
                          className={`w-full bg-white border ${!isManifestMatched && !scanOriginalTag && !scanRushTag ? 'border-rose-300' : 'border-slate-250'} rounded-lg p-2 focus:outline-none focus:border-blue-500 font-mono text-xs transition`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex justify-between">
                          <span>Rush Tag No</span>
                          {!isManifestMatched && <span className="text-rose-500 font-bold">*</span>}
                        </label>
                        <input
                          type="text"
                          value={scanRushTag}
                          onChange={(e) => setScanRushTag(e.target.value)}
                          placeholder="e.g. LH 900501"
                          required={!isManifestMatched && !scanOriginalTag}
                          className={`w-full bg-white border ${!isManifestMatched && !scanRushTag && !scanOriginalTag ? 'border-rose-300' : 'border-slate-250'} rounded-lg p-2 focus:outline-none focus:border-blue-500 font-mono text-xs transition`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex justify-between">
                          <span>Flight Number</span>
                          {!isManifestMatched && <span className="text-rose-500 font-bold">*</span>}
                        </label>
                        <input
                          type="text"
                          value={scanFlightNo}
                          onChange={(e) => setScanFlightNo(e.target.value)}
                          placeholder="e.g. Flight No"
                          list="manifest-flights-list"
                          required={!isManifestMatched}
                          className={`w-full bg-white border ${!isManifestMatched && !scanFlightNo ? 'border-rose-300' : 'border-slate-250'} rounded-lg p-2 focus:outline-none focus:border-blue-500 font-mono text-xs transition`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex justify-between">
                          <span>Destination</span>
                          {!isManifestMatched && <span className="text-rose-500 font-bold">*</span>}
                        </label>
                        <input
                          type="text"
                          value={scanDestination}
                          onChange={(e) => setScanDestination(e.target.value)}
                          placeholder="e.g. FRA"
                          required={!isManifestMatched}
                          className={`w-full bg-white border ${!isManifestMatched && !scanDestination ? 'border-rose-300' : 'border-slate-250'} rounded-lg p-2 focus:outline-none focus:border-blue-500 text-xs transition`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Seal Number</label>
                        <input
                          type="text"
                          value={scanSealNo}
                          onChange={(e) => setScanSealNo(e.target.value)}
                          placeholder="e.g. S-712"
                          className="w-full bg-white border border-slate-250 rounded-lg p-2 focus:outline-none focus:border-blue-500 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Destination Airport</label>
                        <input
                          type="text"
                          value={scanDestination}
                          onChange={(e) => setScanDestination(e.target.value)}
                          placeholder="e.g. FRA, CDG, ORD"
                          className="w-full bg-white border border-slate-250 rounded-lg p-2 focus:outline-none focus:border-blue-500 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Remarks</label>
                        <textarea
                          rows={2}
                          value={scanRemarks}
                          onChange={(e) => setScanRemarks(e.target.value)}
                          placeholder="Provide specific notes..."
                          className="w-full bg-white border border-slate-250 rounded-lg p-2 focus:outline-none focus:border-blue-500 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs hover:shadow-sm transition duration-150 flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <ScanLine className="h-4 w-4" />
                    Register / Scanned Inbound Tag
                  </button>
                </form>

                {/* Simulated Scans Generator panel */}
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Simulate Barcode Gun (Click for Testing)</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => runSimulatedScan('0220123456', 'loc-1', 'Scanned')}
                      className="border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/20 text-left p-2.5 rounded-xl text-xs transition cursor-pointer hover:shadow-xs"
                    >
                      <span className="font-mono text-blue-600 block font-bold">0220123456</span>
                      <span className="text-[10px] text-slate-500 flex justify-between">Lufthansa LH 123456</span>
                    </button>
                    <button
                      onClick={() => runSimulatedScan('LH 123456', 'loc-2', 'In Transit')}
                      className="border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/20 text-left p-2.5 rounded-xl text-xs transition cursor-pointer hover:shadow-xs"
                    >
                      <span className="font-mono text-indigo-600 block font-bold">LH 123456</span>
                      <span className="text-[10px] text-slate-500">Resolves LH 123456</span>
                    </button>
                    <button
                      onClick={() => runSimulatedScan('UA 456789', 'loc-3', 'Delivered')}
                      className="border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/20 text-left p-2.5 rounded-xl text-xs transition cursor-pointer hover:shadow-xs"
                    >
                      <span className="font-mono text-amber-600 block font-bold">UA 456789</span>
                      <span className="text-[10px] text-slate-500">Resolves UA 456789</span>
                    </button>
                    <button
                      onClick={() => runSimulatedScan('0016456789', 'loc-4', 'Scanned')}
                      className="border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/20 text-left p-2.5 rounded-xl text-xs transition cursor-pointer hover:shadow-xs"
                    >
                      <span className="font-mono text-emerald-600 block font-bold">0016456789</span>
                      <span className="text-[10px] text-slate-500">Equivalent to UA 456789</span>
                    </button>
                    <button
                      onClick={() => runSimulatedScan('DL 789012', 'loc-5', 'Customs Hold')}
                      className="border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/20 text-left p-2.5 rounded-xl text-xs transition cursor-pointer hover:shadow-xs"
                    >
                      <span className="font-mono text-violet-600 block font-bold">DL 789012</span>
                      <span className="text-[10px] text-slate-500">Delta Air Lines</span>
                    </button>
                    <button
                      onClick={() => runSimulatedScan('0220888999', 'loc-1', 'Scanned')}
                      className="border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/20 text-left p-2.5 rounded-xl text-xs transition cursor-pointer hover:shadow-xs"
                    >
                      <span className="font-mono text-slate-700 block font-bold">0220888999</span>
                      <span className="text-[10px] text-slate-500">Lufthansa (Scanned)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Locations Management Block */}
              <div className="md:col-span-5 space-y-6">
                
                {/* Dynamic Locations Configurator Panel */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-3">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Dynamic Location Slots</h2>
                  </div>
                  
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Manage destination/carousel slots on-the-fly. This updates scanning inputs, filters, and reports instantly without code changes.
                  </p>

                  {!isAdmin ? (
                    <div className="text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-250 rounded-xl space-y-3 mb-4">
                      <Lock className="h-8 w-8 text-slate-400 mx-auto animate-pulse" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">Dynamic Slots Editing Blocked</p>
                        <p className="text-[11px] text-slate-505 mt-1 leading-relaxed max-w-xs mx-auto">
                          To change the database of Location Slots and Delivery Agents requires an authorized Administrator sign-in.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdminModal(true)}
                        className="bg-slate-850 hover:bg-slate-900 text-white text-[11px] font-bold py-1.5 px-3 rounded-xl transition cursor-pointer font-mono"
                      >
                        Sign-In to Unlock
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleCreateLocation} className="space-y-3.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Location Identifier/Name</label>
                        <input
                          type="text"
                          value={newLocName}
                          onChange={(e) => setNewLocName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 text-slate-800 rounded-lg p-2.5 px-3 focus:outline-none text-sm font-medium"
                          placeholder="e.g. Carousel 12, Terminal A Rack"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Functional Category</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setNewLocType('Storage')}
                            className={`p-2.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                              newLocType === 'Storage' 
                                ? 'border-blue-500 bg-blue-50/40 text-blue-600 shadow-xs' 
                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            Storage (e.g. Warehouse)
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewLocType('Delivery')}
                            className={`p-2.5 rounded-lg border text-xs font-bold transition-all duration-200 cursor-pointer ${
                              newLocType === 'Delivery' 
                                ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm ring-2 ring-blue-600/20 scale-[1.02]' 
                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            Delivery (e.g. Carousel)
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isCreatingLoc}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl border border-transparent transition flex items-center justify-center gap-2 text-xs cursor-pointer shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Location Slot
                      </button>
                    </form>
                  )}

                  {/* Active slots summary */}
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="block text-[10px] font-bold text-slate-505 uppercase tracking-wide">Currently Active Slots ({locations.length})</span>
                      <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Live DB</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin">
                      {locations.map(loc => (
                        <div key={loc.id} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50/50 border border-slate-200/60 text-xs hover:bg-slate-50 transition">
                          <span className="font-semibold text-slate-700">{loc.location_name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${loc.location_type === 'Storage' ? 'bg-amber-100 text-amber-700 border border-amber-200/50' : 'bg-blue-100 text-blue-700 border border-blue-200/50'}`}>
                              {loc.location_type}
                            </span>
                            {/* Admin only delete */}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteLocation(loc.id)}
                                className="text-red-500 hover:text-red-750 transition cursor-pointer p-1 rounded hover:bg-slate-100"
                                title="Delete Dynamic Slot"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Delivery Agent Configurator Panel */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-3">
                    <Wrench className="h-5 w-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Delivery Agent Database</h2>
                  </div>

                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Configure official logistics carriers and transport operators registered for cargo handling authorization.
                  </p>

                  {!isAdmin ? (
                    <div className="text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-250 rounded-xl space-y-3 mb-4">
                      <Lock className="h-8 w-8 text-slate-400 mx-auto animate-pulse" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">Database Modification Disabled</p>
                        <p className="text-[11px] text-slate-505 mt-1 leading-relaxed max-w-xs mx-auto">
                          To change the database of Location Slots and Delivery Agents requires an authorized Administrator sign-in.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdminModal(true)}
                        className="bg-slate-850 hover:bg-slate-900 text-white text-[11px] font-bold py-1.5 px-3 rounded-xl transition cursor-pointer font-mono"
                      >
                        Sign-In to Unlock
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleCreateAgent} className="space-y-3.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Agent / Company Name</label>
                        <input
                          type="text"
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-500 text-slate-800 rounded-lg p-2.5 px-3 focus:outline-none text-sm font-medium"
                          placeholder="e.g. DHL Express, Speed Cargo, Lufthansa Ground"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isCreatingAgent}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl border border-transparent transition flex items-center justify-center gap-2 text-xs cursor-pointer shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Delivery Agent
                      </button>
                    </form>
                  )}

                  {/* Active delivery agents list loaded from State */}
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <span className="block text-[10px] font-bold text-slate-505 uppercase tracking-wide mb-2.5 font-sans">Registered Handlers ({deliveryAgents?.length || 0})</span>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin">
                      {deliveryAgents && deliveryAgents.length > 0 ? (
                        deliveryAgents.map(agent => (
                          <div key={agent.id} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50/50 border border-slate-200/60 text-xs hover:bg-slate-50 transition">
                            <span className="font-semibold text-slate-705">{agent.agent_name}</span>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteAgent(agent.id)}
                                className="text-red-500 hover:text-red-750 transition cursor-pointer p-1 rounded hover:bg-slate-100"
                                title="Delete Delivery Agent"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No delivery agents active in database.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reset system block (Admin Protected) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center">
                  <p className="text-xs text-slate-500 mb-3">Re-populate audit registry and system baggage database to factory settings.</p>
                  {isAdmin ? (
                    <button
                      onClick={handleResetDatabase}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 p-2.5 px-4 rounded-xl transition inline-flex items-center gap-2 font-bold cursor-pointer shadow-xs"
                    >
                      <RefreshCcw className="h-3.5 w-3.5 text-slate-500" />
                      Reset FAA Sample Dataset
                    </button>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic font-medium">
                      Reset Dataset requires Admin authentication status.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: BATCH DISPOSITION */}
          {activeTab === 'batch-dispo' && (
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-12 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-5">
                  <div className="p-3 bg-blue-100/50 rounded-xl">
                    <Layers className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 font-display">Batch Allocation & Disposition</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Bulk allocate registered baggage or manifest identities to target warehouse slots.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleBatchDispoSubmit} className="space-y-8 max-w-4xl mx-auto">
                  {/* Step 1: Location Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold">1</span>
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Select Assigned Location Slot</h3>
                    </div>
                    
                    <div className="pl-8">
                      <select
                        value={batchLocationId}
                        onChange={(e) => setBatchLocationId(e.target.value)}
                        className="w-full md:w-2/3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 rounded-xl p-4 focus:outline-none font-semibold text-base transition cursor-pointer shadow-sm"
                        required
                      >
                        <option value="">-- Choose Target Disposition Slot --</option>
                        <optgroup label="Physical Storage Locations">
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.location_name} ({loc.location_type} Zone)
                            </option>
                          ))}
                        </optgroup>
                        
                        <optgroup label="Delivery Agents Database">
                          {deliveryAgents.map((agent) => (
                            <option key={agent.id} value={`agent:${agent.id}`}>
                              🚚 {agent.agent_name} (Registered Agent)
                            </option>
                          ))}
                        </optgroup>

                        <optgroup label="Forwarding & Disposition">
                          <option value="type:Domestic forward">✈️ Domestic Forwarding (Dom Forwarding)</option>
                          <option value="type:Handover to OAL">🤝 Handover to OAL</option>
                          <option value="type:DID NOT ARRIVE">❌ DID NOT ARRIVE (Negative Scan)</option>
                        </optgroup>
                      </select>
                      <p className="text-[11px] text-slate-400 mt-2 italic">
                        * All tags entered below will be moved to this location record in the registry.
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Tag Entry */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                       <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold">2</span>
                       <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Scan or Enter Multiple Tags</h3>
                    </div>

                    <div className="pl-8 space-y-4">
                      <div className="relative">
                        <textarea
                          value={batchTagsInput}
                          onChange={(e) => setBatchTagsInput(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-900 font-mono text-base tracking-widest rounded-2xl p-6 min-h-[250px] focus:outline-none placeholder-slate-300 shadow-inner leading-relaxed resize-none"
                          placeholder={`Enter one tag per line or separated by commas.\n\nExample:\n0220123456\nLH 123456\n0016456789`}
                          required
                        />
                        <div className="absolute top-4 right-4 flex flex-col gap-2">
                           <button
                             type="button"
                             onClick={() => startCameraScan('environment')}
                             className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold p-2.5 px-4 rounded-xl text-[10px] uppercase tracking-wider transition shadow-sm cursor-pointer"
                           >
                             <Camera className="h-4 w-4" />
                             Scan via Camera
                           </button>
                           {batchTagsInput && (
                             <button
                               type="button"
                               onClick={() => setBatchTagsInput('')}
                               className="text-slate-400 hover:text-rose-500 font-bold text-[10px] uppercase tracking-widest text-right px-2 cursor-pointer transition"
                             >
                               Reset Field
                             </button>
                           )}
                        </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Validation Protocol</p>
                          <p className="text-[11px] text-amber-800 leading-relaxed mt-1">
                            The system will automatically resolve raw 10-digit barcodes and alpha-license tags. If a tag identity is found in the **Live Flight Manifest** but not yet in the Registry, it will be automatically registered with the manifest&apos;s passenger data.
                          </p>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isProcessingBatch || !batchLocationId || !batchTagsInput.trim()}
                        className={`w-full py-5 rounded-2xl font-bold text-lg shadow-xl transition duration-200 flex items-center justify-center gap-3 cursor-pointer ${
                          isProcessingBatch || !batchLocationId || !batchTagsInput.trim()
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed grayscale'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                        }`}
                      >
                        {isProcessingBatch ? (
                          <>
                            <RefreshCcw className="h-6 w-6 animate-spin" />
                            Synchronizing Batch Identities...
                          </>
                        ) : (
                          <>
                            <Layers className="h-6 w-6" />
                            Submit Batch Disposition ({batchTagsInput.split(/[\n,]+/).filter(t => t.trim()).length} Tags)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: ADVANCED SEARCH & RECONCILIATION SEARCH */}
          {activeTab === 'search' && (
            <div className="col-span-12 space-y-6">
              
              {/* Filter Panel */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                  <Filter className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Dynamic Search Filter Controls</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search query input */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search Tag / Serial / Carrier</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 rounded-xl p-2.5 px-3 focus:outline-none text-sm placeholder-slate-400 font-mono"
                        placeholder="Type Tag number or LH/UA..."
                      />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  {/* Dynamic Location selectors */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dynamic Allocation Space</label>
                    <select
                      value={filterLocationId}
                      onChange={(e) => setFilterLocationId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-sm font-medium cursor-pointer"
                    >
                      <option value="all">ALL Active Location Slots</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.location_name} ({loc.location_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Operational Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-sm font-medium cursor-pointer"
                    >
                      <option value="all">ALL Status Settings</option>
                      <option value="Scanned">Scanned</option>
                      <option value="In Transit">In Transit</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Customs Hold">Customs Hold</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Left behind on Domestic transfer">Left behind on Domestic transfer</option>
                      <option value="Level 4">Level 4</option>
                      <option value="Marked Preventive">Marked Preventive</option>
                      <option value="Customs Refused">Customs Refused</option>
                      <option value="awaiting Pax Pickup">awaiting Pax Pickup</option>
                      <option value="Not traced">Not traced</option>
                      <option value="DID NOT ARRIVE">DID NOT ARRIVE</option>
                      <option value="For Delivery">For Delivery</option>
                      <option value="OAL Claim">OAL Claim</option>
                      <option value="DOM FWD">DOM FWD</option>
                      <option value="Hold">Hold</option>
                      <option value="Re-Export">Re-Export</option>
                    </select>
                  </div>

                  {/* Dynamic Carrier prefix dropdown compiled from actual database */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Active Air Carrier</label>
                    <select
                      value={filterCarrier}
                      onChange={(e) => setFilterCarrier(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-sm font-medium cursor-pointer"
                    >
                      <option value="all">ALL Airlines ({dynamicCarriers.length})</option>
                      {dynamicCarriers.map((airline) => (
                        <option key={airline} value={airline}>
                          {airline}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Flight Number Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Flight Number</label>
                    <select
                      value={filterFlight}
                      onChange={(e) => setFilterFlight(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-sm font-medium cursor-pointer"
                    >
                      <option value="all">all / ALL Flights</option>
                      {activeFlightOptions.map((flight) => (
                        <option key={flight} value={flight}>
                          {flight}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Delivery Agent Database Filter (Multi-Select) */}
                  <div className="lg:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Delivery Agent database</span>
                    </label>
                    <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <label className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${filterAgents.includes('all') ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-100 hover:border-indigo-300'}`}>
                        <input
                          type="checkbox"
                          className="w-3 h-3 accent-indigo-600"
                          checked={filterAgents.includes('all')}
                          onChange={() => setFilterAgents(['all'])}
                        />
                        ALL Agents
                      </label>
                      {deliveryAgents.map(agent => (
                        <label key={agent.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${filterAgents.includes(agent.id) ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-100 hover:border-indigo-300'}`}>
                          <input
                            type="checkbox"
                            className="w-3 h-3 accent-indigo-600"
                            checked={filterAgents.includes(agent.id)}
                            onChange={() => {
                              if (filterAgents.includes('all')) {
                                setFilterAgents([agent.id]);
                              } else if (filterAgents.includes(agent.id)) {
                                const next = filterAgents.filter(id => id !== agent.id);
                                setFilterAgents(next.length === 0 ? ['all'] : next);
                              } else {
                                setFilterAgents([...filterAgents, agent.id].filter(id => id !== 'all'));
                              }
                            }}
                          />
                          {agent.agent_name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-slate-100 gap-4">
                  <div className="flex items-center gap-4">
                    {(searchQuery || filterLocationId !== 'all' || filterStatus !== 'all' || filterCarrier !== 'all' || filterFlight !== 'all' || !filterAgents.includes('all')) && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterLocationId('all');
                          setFilterStatus('all');
                          setFilterCarrier('all');
                          setFilterFlight('all');
                          setFilterAgents(['all']);
                        }}
                        className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 font-bold cursor-pointer"
                      >
                        <RefreshCcw className="h-3 w-3" />
                        Clear All Filter Criteria
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={exportForBDO}
                      disabled={isExportingBDO || filteredBaggage.length === 0}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                        isExportingBDO || filteredBaggage.length === 0
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95'
                      }`}
                    >
                      {isExportingBDO ? (
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4" />
                      )}
                      Export for BDO creation by S-BSC ({filteredBaggage.length})
                    </button>
                  </div>
                </div>
              </div>

              {/* Admin Mode: Flight Options Management */}
              {isAdmin && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Settings className="h-5 w-5 text-indigo-400" />
                    <h2 className="text-lg font-bold text-white font-display uppercase tracking-tight">Admin: Flight Filter Options Configuration</h2>
                  </div>
                  
                  <div className="space-y-4 max-w-2xl">
                    <p className="text-xs text-slate-400 leading-relaxed italic">
                      Edit the available Flight Number filter options. Separate each option with a comma.
                    </p>
                    
                    <div className="flex flex-col gap-3">
                      <div className="relative">
                        <textarea
                          value={newFlightsInput}
                          onChange={(e) => setNewFlightsInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 font-mono text-sm rounded-xl p-4 min-h-[100px] focus:outline-none focus:border-indigo-500 shadow-inner"
                          placeholder="LH760, LH762, LX146, LX2646, OAL, Level 4"
                        />
                        <div className="absolute right-3 bottom-3 flex items-center gap-2">
                           <button
                             onClick={() => setNewFlightsInput('LH760, LH762, LX146, LX2646, OAL, Level 4')}
                             className="text-[9px] text-slate-500 hover:text-slate-300 font-bold uppercase tracking-widest transition"
                           >
                              Reset to Default
                           </button>
                        </div>
                      </div>
                      
                      <button
                        onClick={saveAllowedFlights}
                        disabled={isProcessingFlights}
                        className={`flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm transition shadow-lg ${
                          isProcessingFlights 
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-900/20 active:scale-[0.98]'
                        }`}
                      >
                        {isProcessingFlights ? (
                          <>
                            <RefreshCcw className="h-4 w-4 animate-spin" />
                            Updating Global Filter Catalog...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Update Registry Filter Options
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Major Baggage items registry result */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 text-base">Reconciliation Baggage Records</h3>
                  <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-1 font-mono font-bold">
                    Showing {filteredBaggage.length} of {baggageItems.length} scanned bags
                  </span>
                </div>

                {filteredBaggage.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-3">
                    <Database className="h-12 w-12 text-slate-400 mx-auto" />
                    <p className="text-slate-600 font-bold font-display">No registered bags found matching search criteria.</p>
                    <p className="text-xs max-w-sm mx-auto text-slate-400">Try clearing search filters or Scan a mock barcode tag under the Registration form.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 font-mono text-[11px] text-slate-505 font-bold uppercase tracking-wider">
                          <th className="p-4 px-6">Equivalent Identities</th>
                          <th className="p-4">Air Carrier</th>
                          <th className="p-4">Assigned Location</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-center">Actions / Corrections</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/80">
                        {filteredBaggage.map((bag) => {
                          const associatedLoc = locations.find(l => l.id === bag.current_location_id);
                          
                          return (
                            <tr key={bag.id} className="hover:bg-slate-50/50 transition">
                              <td className="p-4 px-6">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm text-blue-600 tracking-wider font-bold">✓ {bag.alpha_tag}</span>
                                    <span className="text-[10px] text-blue-700 bg-blue-50 rounded border border-blue-105 px-1.5 py-0.5 font-mono font-semibold">IATA License</span>
                                  </div>
                                  <div className="font-mono text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    <span>Barcode: {bag.universal_tag}</span>
                                  </div>

                                  {bag.passenger_name && (
                                    <div className="mt-2 p-2.5 bg-blue-50/20 border border-blue-105/50 rounded-xl space-y-1 max-w-[320px]">
                                      <div className="text-[9px] uppercase font-bold text-blue-600 tracking-wider flex items-center gap-1">
                                        <FileSpreadsheet className="h-3 w-3 shrink-0" />
                                        <span>Flight Manifest Match</span>
                                      </div>
                                      <div className="text-[11px] text-slate-800 leading-tight">
                                        Passenger: <strong className="text-slate-900 font-bold">{bag.passenger_name}</strong>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono mt-0.5">
                                        {bag.pir && <div className="leading-tight">PIR: <span className="text-slate-700 font-semibold">{bag.pir}</span></div>}
                                        {bag.flight_no && <div className="leading-tight">Flight: <span className="text-slate-700 font-semibold">{bag.flight_no}</span></div>}
                                        {bag.rush_tag && <div className="col-span-2 leading-tight">Rush: <span className="text-amber-800 bg-amber-50 rounded border border-amber-200/60 px-1 py-0.5 font-serif">{bag.rush_tag}</span></div>}
                                        {bag.seal_no && <div className="leading-tight">Seal: <span className="text-slate-700 font-semibold">{bag.seal_no}</span></div>}
                                        {bag.destination && <div className="leading-tight">Dest: <span className="text-slate-700 font-semibold bg-slate-100 border border-slate-200 px-1 rounded">{bag.destination}</span></div>}
                                      </div>
                                      {bag.remarks && (
                                        <div className="text-[10px] text-slate-500 italic border-t border-slate-200/50 pt-1 mt-1 leading-normal">
                                          &ldquo;{bag.remarks}&rdquo;
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {bag.dispo_type && (
                                    <div className="mt-1.5 p-2 bg-slate-50/80 border border-slate-205/60 rounded-xl space-y-1 max-w-[280px]">
                                      <div className="flex items-center gap-1">
                                        <Wrench className="h-3 w-3 text-blue-600" />
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{bag.dispo_type}</span>
                                      </div>
                                      <div className="text-[11px] font-bold text-slate-800 break-words leading-tight">{bag.dispo_value}</div>
                                      {bag.dispo_remarks && (
                                        <div className="text-[10px] text-slate-500 italic break-words">“{bag.dispo_remarks}”</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="text-xs text-slate-600 font-medium">{bag.airline_name}</span>
                              </td>
                              <td className="p-4">
                                {associatedLoc ? (
                                  <div className="space-y-0.5">
                                    <span className="text-xs text-slate-900 font-semibold flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5 text-blue-500 mt-0.5" />
                                      {associatedLoc.location_name}
                                    </span>
                                    <span className={`text-[10px] block font-mono pl-4 font-semibold ${associatedLoc.location_type === 'Storage' ? 'text-amber-600' : 'text-indigo-650'}`}>
                                      ({associatedLoc.location_type} Zone)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-rose-500 font-semibold">Location Missing</span>
                                )}
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold font-mono rounded-full px-2.5 py-1 uppercase tracking-wide border ${
                                  bag.status === 'Delivered' 
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                    : bag.status === 'Damaged' 
                                    ? 'bg-red-50 text-red-800 border-red-250' 
                                    : bag.status === 'Customs Hold'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  {bag.status}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {/* Amend button */}
                                  <button
                                    onClick={() => {
                                      setEditingBag(bag);
                                      setAmendLocationId(bag.current_location_id);
                                      setAmendStatus(bag.status);
                                      setAmendDispoType((bag.dispo_type as any) || '');
                                      setAmendDispoValue(bag.dispo_value || '');
                                      setAmendDispoRemarks(bag.dispo_remarks || '');
                                      setAmendPir(bag.pir || '');
                                      setAmendPassengerName(bag.passenger_name || '');
                                      setAmendOriginalTag(bag.original_tag || '');
                                      setAmendRushTag(bag.rush_tag || '');
                                      setAmendFlightNo(bag.flight_no || '');
                                      setAmendSealNo(bag.seal_no || '');
                                      setAmendDestination(bag.destination || '');
                                      setAmendRemarks(bag.remarks || '');
                                    }}
                                    className="p-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 rounded-lg transition cursor-pointer hover:bg-blue-50/20"
                                    title="Amend Baggage Tracking Location"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>

                                  {/* Soft delete button */}
                                  <button
                                    onClick={() => {
                                      setDeletingBag(bag);
                                    }}
                                    className="p-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 hover:border-red-300 text-slate-500 hover:text-red-600 rounded-lg transition cursor-pointer hover:bg-red-50/20"
                                    title="Compliance Flight Strike / Deletion"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: REGULATORY FAA AUDIT TRAIL LOGS */}
          {activeTab === 'logs' && (
            <div className="col-span-12 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-slate-900 font-display">Archived Auditor Compliance Trail</h2>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-50 text-blue-700 rounded border border-blue-100 py-0.5 px-2 font-bold">Non-Destructive Database Ledger</span>
                </div>

                <p className="text-xs text-slate-505 mb-4 leading-relaxed">
                  Every amendment or deletion creates an immutable register entry under international aviation standard requirements. Supervisors can trace full location transitions, reasons code selections, and operator IDs.
                </p>

                {auditLogs.length === 0 ? (
                  <div className="p-12 text-center text-slate-450">
                    <Activity className="h-10 w-10 text-slate-350 mx-auto mb-2" />
                    <span>No transition compliance logs found. scan initial baggage items above.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 font-mono text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          <th className="p-3 pl-4">Timestamp Urgent</th>
                          <th className="p-3">Baggage Identifier</th>
                          <th className="p-3 text-center">Transition Map</th>
                          <th className="p-3">Mandatory Reason</th>
                          <th className="p-3">Signoff Operator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-mono text-slate-730">
                        {auditLogs.slice().reverse().map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/70 transition">
                            <td className="p-3 pl-4 text-slate-500 text-[11px]">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3 font-semibold text-blue-600">
                              <div className="text-[11px] font-bold">{log.alpha_tag}</div>
                              <div className="text-[10px] text-slate-500">{log.universal_tag}</div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2 text-[10px] md:text-xs">
                                {log.previous_location_id ? (
                                  <span className="text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                    {log.previous_location_name}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic bg-slate-50 px-1.5 py-0.5 rounded border border-slate-150">Initial Entry</span>
                                )}
                                <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
                                {log.new_location_id ? (
                                  <span className="text-slate-800 bg-slate-50 border border-slate-205 px-1.5 py-0.5 rounded font-semibold text-[11px]">
                                    {log.new_location_name}
                                  </span>
                                ) : (
                                  <span className="text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded font-semibold">
                                    Deleted
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-slate-700 font-sans">
                              <span className="text-[11px] font-semibold bg-slate-100 border border-slate-200 text-slate-600 rounded px-1.5 py-0.5 block md:inline-block">
                                {log.reason}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 text-[11px] font-semibold italic font-sans">
                              {log.agent_id}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: FLIGHT MANIFEST EXCEL/CSV RECONCILIATION */}
          {activeTab === 'reconcile' && (
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-12 gap-6 relative">
              
              {/* Manifest Input Controls */}
              <div className={`${isReconcileSidebarCollapsed ? 'hidden md:hidden' : 'md:col-span-4'} bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit sticky top-24`}>
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Reconciliation Input</h2>
                  </div>
                  <button 
                    onClick={() => setIsReconcileSidebarCollapsed(true)}
                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer transition"
                    title="Collapse Sidebar"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-505 mb-4 leading-relaxed">
                  Import expected flight manifest tags from an Excel list (`.xlsx / .csv`) or paste baggage barcodes raw to generate matching scorecards.
                </p>

                {/* Historial manifest drop list filter */}
                <div className="mb-5 bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Filter Manifests By Flight</label>
                  <select 
                    value={filterFlight}
                    onChange={(e) => setFilterFlight(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
                  >
                    <option value="all">all / ALL Flights</option>
                    {activeFlightOptions.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <form onSubmit={handleManifestSubmit} className="space-y-4">
                  {/* File Upload zone */}
                  <div className="border border-dashed border-slate-300 hover:border-blue-500/80 rounded-xl p-5 bg-slate-50/50 text-center transition relative cursor-pointer group">
                    <input
                      type="file"
                      accept=".csv,.txt,.xlsx,.xls"
                      onChange={handleManifestCsvUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="h-5 w-5 text-slate-400 group-hover:text-blue-600 mx-auto mb-1" />
                    <span className="block text-xs font-bold text-slate-705 mb-0.5">Upload Manifest File</span>
                    <span className="block text-[10px] text-slate-500">Supports .xlsx, .xls Excel or .csv, .txt barcode list</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expected Flight Number</label>
                    <input
                      type="text"
                      value={manifestFlightInput}
                      onChange={(e) => setManifestFlightInput(e.target.value)}
                      list="manifest-flights-list"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono text-sm uppercase rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500"
                      placeholder="e.g. Flight No"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expected Barcodes Paste</label>
                      <button
                        type="button"
                        onClick={loadDemoManifestStr}
                        className="text-[10px] text-blue-600 hover:text-blue-700 hover:underline font-bold cursor-pointer font-sans"
                      >
                        Autofill Demo List
                      </button>
                    </div>
                    <textarea
                      value={rawManifestPaste}
                      onChange={(e) => setRawManifestPaste(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-mono text-xs rounded-xl p-2.5 h-32 focus:outline-none placeholder-slate-400 focus:bg-white focus:border-blue-500"
                      placeholder="Paste tags (one per line, e.g.&#10;LH 123456&#10;0220123457&#10;0220123458)"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition cursor-pointer shadow-xs"
                  >
                    Compile Manifest Checkboard
                  </button>
                </form>



                  {/* Admin Flight Options Management in Reconcile Tab */}
                  {isAdmin && (
                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-indigo-600" />
                        <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Flight Option Registry</h4>
                      </div>
                      <textarea
                        value={newFlightsInput}
                        onChange={(e) => setNewFlightsInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-mono text-[10px] rounded-lg p-2 h-16 focus:outline-none focus:border-indigo-500"
                        placeholder="LH760, LX146..."
                      />
                      <button
                        onClick={saveAllowedFlights}
                        disabled={isProcessingFlights}
                        className={`w-full py-2 px-3 rounded-lg font-bold text-[10px] transition text-center uppercase tracking-widest cursor-pointer ${
                          isProcessingFlights 
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                        }`}
                      >
                        {isProcessingFlights ? 'Updating...' : 'Save Registry'}
                      </button>
                    </div>
                  )}
                </div>

              {/* Manifest Output scorecard */}
              <div className={`${isReconcileSidebarCollapsed ? 'md:col-span-12' : 'md:col-span-8'} bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all duration-300`}>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800 gap-3">
                    <div className="flex items-center gap-3">
                      {isReconcileSidebarCollapsed && (
                        <button 
                          onClick={() => setIsReconcileSidebarCollapsed(false)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white cursor-pointer transition border border-slate-700"
                          title="Expand Sidebar"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      )}
                      <div>
                        <span className="text-[10px] uppercase font-mono text-cyan-400 tracking-widest font-semibold">Verification Audit Dashboard</span>
                        <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                          Flight Manifest Details: <span className="font-mono text-indigo-400">All Active Flights</span>
                        </h3>
                      </div>
                    </div>

                    {manifests.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono italic">
                        Aggregating {manifests.length} manifests
                      </span>
                    )}
                  </div>

                  {manifests.length === 0 ? (
                    <div className="text-center p-16 text-slate-500">
                      <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 text-slate-600" />
                      <span>Create and save a high-level manifest on the left pane to check reconciliation.</span>
                    </div>
                  ) : (
                    <div className="space-y-6 mt-5">
                      {/* Concordance Rate Card and Score Ring */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between text-center">
                          <span className="block text-[10px] text-slate-500 uppercase tracking-wide">Total Barcodes Expected</span>
                          <span className="text-3xl font-bold font-mono text-white mt-1">{totalExpected}</span>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col justify-between text-center border-emerald-950/40">
                          <span className="block text-[10px] text-emerald-500 font-semibold uppercase tracking-wide">Scanned & Safe (Arrived)</span>
                          <span className="text-3xl font-bold font-mono text-emerald-400 mt-1">{matchedScannedBags.length}</span>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col justify-between text-center border-red-950/40">
                          <span className="block text-[10px] text-red-500 font-semibold uppercase tracking-wide">Missing / Not Scanned</span>
                          <span className="text-3xl font-bold font-mono text-red-400 mt-1">{missingBagsFromManifest.length}</span>
                        </div>
                      </div>

                      {/* Concentric Progress Meter */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-600 font-bold">Reconciliation Consistency Percentage</span>
                          <span className={`text-xs font-mono font-bold ${reconciliationPercent === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {reconciliationPercent}% Checked
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-100">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${reconciliationPercent === 100 ? 'bg-emerald-600' : 'bg-red-600'}`}
                            style={{ width: `${reconciliationPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Real-time Row-by-Row Spreadsheet Reconciliation Grid */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-display font-semibold text-white flex items-center gap-1.5 font-mono uppercase tracking-wider">
                              <FileSpreadsheet className="h-4 w-4 text-red-500" />
                              Live Flight Manifest Spreadsheet Ledger ({reconciliationRows.length} Rows)
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {selectedManifestRowIds.length > 0 && (
                              <button
                                onClick={() => handleDeleteManifestRows(selectedManifestRowIds)}
                                className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 rounded transition shadow-sm cursor-pointer"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete {selectedManifestRowIds.length} Selected
                              </button>
                            )}
                            <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded">
                              Reconciliation Engine Active
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                          <table className="w-full text-left border-collapse text-[11px] font-mono whitespace-nowrap">
                            <thead>
                              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[9px] font-bold">
                                <th className="p-3 pl-4 w-10">
                                  <input 
                                    type="checkbox" 
                                    className="accent-blue-500 cursor-pointer"
                                    checked={selectedManifestRowIds.length > 0 && selectedManifestRowIds.length === filteredReconciliationRows.length}
                                    onChange={() => toggleAllRows(filteredReconciliationRows)}
                                  />
                                </th>
                                <th className="p-3">PIR Number</th>
                                <th className="p-3">Passenger Name</th>
                                <th className="p-3">Original Tag</th>
                                <th className="p-3">Rush Tag</th>
                                <th className="p-3">Flight No</th>
                                <th className="p-3">Seal No</th>
                                <th className="p-3">Destination</th>
                                <th className="p-3">Remarks</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-right pr-4">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/60 text-slate-300">
                              {filteredReconciliationRows.map((row) => {
                                // Find match on barcode
                                const rowOrigParsed = parseBagTag(row.original_tag);
                                const rowRushParsed = parseBagTag(row.rush_tag);
                                const rowOrigUniversal = rowOrigParsed ? rowOrigParsed.universalTag : row.original_tag;
                                const rowRushUniversal = rowRushParsed ? rowRushParsed.universalTag : row.rush_tag;

                                const matchedScanned = baggageItems.find(scanned => 
                                  scanned.universal_tag === rowOrigUniversal || 
                                  scanned.universal_tag === rowRushUniversal ||
                                  scanned.universal_tag === row.original_tag || 
                                  scanned.universal_tag === row.rush_tag
                                );

                                const isArrived = !!matchedScanned;
                                const currentStatus = matchedScanned ? matchedScanned.status : 'DID NOT ARRIVE';
                                const currentSlot = matchedScanned 
                                  ? (locations.find(l => l.id === matchedScanned.current_location_id)?.location_name || 'Unassigned') 
                                  : 'Not Checked In';

                                return (
                                  <tr 
                                    key={row.id} 
                                    className={`hover:bg-slate-900/40 transition duration-150 ${
                                      selectedManifestRowIds.includes(row.id) ? 'bg-blue-900/10' :
                                      isArrived 
                                        ? 'bg-emerald-950/10 border-l-4 border-l-emerald-500' 
                                        : 'bg-red-950/10 border-l-4 border-l-rose-500'
                                    }`}
                                  >
                                    <td className="p-3 pl-4">
                                      <input 
                                        type="checkbox" 
                                        className="accent-blue-500 cursor-pointer"
                                        checked={selectedManifestRowIds.includes(row.id)}
                                        onChange={() => toggleRowSelection(row.id)}
                                      />
                                    </td>
                                    <td className="p-3 font-bold text-slate-400">{row.pir}</td>
                                    <td className="p-3 text-slate-200 font-sans font-medium">{row.passenger_name}</td>
                                    <td className="p-3 text-blue-400 font-bold">{row.original_tag}</td>
                                    <td className="p-3">
                                      {row.rush_tag ? (
                                        <span className="text-amber-400 bg-amber-950/40 border border-amber-900/50 rounded px-1 rounded-sm text-[10px]">
                                          {row.rush_tag}
                                        </span>
                                      ) : (
                                        <span className="text-slate-600">—</span>
                                      )}
                                    </td>
                                    <td className="p-3 font-semibold text-indigo-400">{row.flight_no}</td>
                                    <td className="p-3 text-slate-400">{row.seal_no}</td>
                                    <td className="p-3">
                                      <span className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-semibold uppercase">
                                        {row.destination}
                                      </span>
                                    </td>
                                    <td className="p-3 text-slate-450 font-sans max-w-[120px] truncate" title={row.remarks}>
                                      {row.remarks || 'No remarks'}
                                    </td>
                                    <td className="p-3 text-center">
                                      {isArrived ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded-full font-bold">
                                          <CheckCircle className="h-2.5 w-2.5" />
                                          ARRIVED
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[9px] text-rose-400 bg-rose-950/60 border border-rose-805/80 px-1.5 py-0.5 rounded-full font-bold">
                                          <XCircle className="h-2.5 w-2.5" />
                                          MISSING
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right pr-4">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => startEditingManifestRow(row)}
                                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
                                          title="Edit Record"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteManifestRows([row.id])}
                                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
                                          title="Delete Record"
                                        >
                                          <Trash2 className="h-3 w-3" />
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
                    </div>
                  )}
                </div>

                {/* Help tip card */}
                {manifests.length > 0 && (
                  <div className="mt-6 bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-slate-600 text-xs leading-relaxed flex items-center gap-3 shadow-xs">
                    <HelpCircle className="h-5 w-5 text-blue-600 shrink-0" />
                    <span>
                      <strong>Equivalence Proof:</strong> Even if a Flight Manifest listed expected barcodes in standard numeric formats (e.g. <code className="bg-slate-200/80 border border-slate-300/60 px-1 py-0.5 rounded font-mono text-slate-800">0220123456</code>) and operators manually scan or type the equivalent Alphabetic tag (e.g. <code className="bg-slate-200/80 border border-slate-300/60 px-1 py-0.5 rounded font-mono text-slate-800">LH 123456</code>), our matching algorithms recognize them as the exact same system baggage, marking them Arrived successfully!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: EDIT MANIFEST ROW */}
      <AnimatePresence>
        {editingManifestRow && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-display font-bold text-slate-900 flex items-center gap-2">
                  <Edit className="h-4 w-4 text-blue-600" />
                  Edit Flight Manifest Record
                </h3>
                <button onClick={() => setEditingManifestRow(null)} className="text-slate-400 hover:text-slate-800 cursor-pointer">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateManifestRow} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">PIR Number</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
                      value={manifestRowEditForm.pir || ''}
                      onChange={e => setManifestRowEditForm({...manifestRowEditForm, pir: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Passenger Name</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
                      value={manifestRowEditForm.passenger_name || ''}
                      onChange={e => setManifestRowEditForm({...manifestRowEditForm, passenger_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Original Tag</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
                      value={manifestRowEditForm.original_tag || ''}
                      onChange={e => setManifestRowEditForm({...manifestRowEditForm, original_tag: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Rush Tag</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
                      value={manifestRowEditForm.rush_tag || ''}
                      onChange={e => setManifestRowEditForm({...manifestRowEditForm, rush_tag: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Flight No</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
                      value={manifestRowEditForm.flight_no || ''}
                      onChange={e => setManifestRowEditForm({...manifestRowEditForm, flight_no: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Destination</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
                      value={manifestRowEditForm.destination || ''}
                      onChange={e => setManifestRowEditForm({...manifestRowEditForm, destination: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Remarks</label>
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500 h-20"
                      value={manifestRowEditForm.remarks || ''}
                      onChange={e => setManifestRowEditForm({...manifestRowEditForm, remarks: e.target.value})}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingManifestRow(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingManifestRow}
                    className={`px-6 py-2 rounded-xl font-bold font-display shadow-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                      isUpdatingManifestRow 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                    }`}
                  >
                    {isUpdatingManifestRow ? (
                      <>
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                        Synchronizing...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AMENDMENT & LOCATION UPDATE COMPLIANCE DRAWER (MODAL) */}
      <AnimatePresence>
        {editingBag && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 shadow-2xl relative"
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 font-bold">Carrier: {editingBag.airline_name}</span>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    Amend Baggage Location: <span className="font-mono text-blue-600">{editingBag.alpha_tag}</span>
                  </h3>
                </div>
                <button
                  onClick={() => setEditingBag(null)}
                  className="text-slate-400 hover:text-slate-800 font-semibold font-mono cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAmendBag} className="space-y-4">
                {/* Visual state summaries */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-bold">10-Digit Barcode</span>
                    <span className="text-slate-700 font-mono font-medium">{editingBag.universal_tag}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-bold">Scanned Status</span>
                    <span className="text-blue-600 font-mono font-bold">{editingBag.status}</span>
                  </div>
                </div>

                {/* Destination Location Dropdown */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Corrected Slot Target
                  </label>
                  <select
                    value={amendLocationId}
                    onChange={(e) => setAmendLocationId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-750 font-semibold rounded-xl p-2.5 focus:outline-none text-sm focus:bg-white focus:border-blue-500 cursor-pointer"
                    required
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.location_name} ({loc.location_type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Options */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Operation State
                  </label>
                  <select
                    value={amendStatus}
                    onChange={(e) => setAmendStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-750 font-semibold rounded-xl p-2.5 focus:outline-none text-sm focus:bg-white focus:border-blue-500 cursor-pointer"
                    required
                  >
                    <option value="Scanned">Scanned</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Customs Hold">Customs Hold</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Left behind on Domestic transfer">Left behind on Domestic transfer</option>
                    <option value="Level 4">Level 4</option>
                    <option value="Marked Preventive">Marked Preventive</option>
                    <option value="Customs Refused">Customs Refused</option>
                    <option value="awaiting Pax Pickup">awaiting Pax Pickup</option>
                    <option value="Not traced">Not traced</option>
                    <option value="DID NOT ARRIVE">DID NOT ARRIVE</option>
                    <option value="For Delivery">For Delivery</option>
                    <option value="OAL Claim">OAL Claim</option>
                    <option value="DOM FWD">DOM FWD</option>
                    <option value="Hold">Hold</option>
                    <option value="Re-Export">Re-Export</option>
                  </select>
                </div>

                {/* BAGGAGE DISPO SECTION */}
                <div className="border-t border-slate-100 pt-3.5 space-y-3.5">
                  <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs uppercase tracking-wider">
                    <Wrench className="h-4 w-4" />
                    <span>Baggage Dispo Options</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-widest mb-1">
                        Disposition Type
                      </label>
                      <select
                        value={amendDispoType}
                        onChange={(e) => {
                          setAmendDispoType(e.target.value as any);
                          setAmendDispoValue('');
                        }}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-705 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-semibold cursor-pointer"
                      >
                        <option value="">-- No Disposition --</option>
                        <option value="Storage Location">Storage Location</option>
                        <option value="Delivery Agent">Delivery Agent</option>
                        <option value="Handover to OAL">Handover to OAL</option>
                        <option value="Domestic forward">Domestic forward</option>
                        <option value="DID NOT ARRIVE">DID NOT ARRIVE</option>
                      </select>
                    </div>

                    {/* Dynamic Value Input depending on type */}
                    {amendDispoType && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-widest mb-1">
                          {amendDispoType === 'Storage Location' && 'Select Storage Spot'}
                          {amendDispoType === 'Delivery Agent' && 'Select Agent'}
                          {amendDispoType === 'Handover to OAL' && 'OAL Airline Carrier'}
                          {amendDispoType === 'Domestic forward' && 'Domestic Forward Information'}
                          {amendDispoType === 'DID NOT ARRIVE' && 'Arrival Failure Status'}
                        </label>

                        {amendDispoType === 'Storage Location' ? (
                          <select
                            value={amendDispoValue}
                            onChange={(e) => setAmendDispoValue(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-705 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-semibold cursor-pointer"
                            required
                          >
                            <option value="">-- Select Spot --</option>
                            {locations
                              .filter(loc => loc.location_type === 'Storage')
                              .map(loc => (
                                <option key={loc.id} value={loc.location_name}>
                                  {loc.location_name}
                                </option>
                              ))}
                          </select>
                        ) : amendDispoType === 'Delivery Agent' ? (
                          <select
                            value={amendDispoValue}
                            onChange={(e) => setAmendDispoValue(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-705 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-semibold cursor-pointer"
                            required
                          >
                            <option value="">-- Select Agent --</option>
                            {deliveryAgents && deliveryAgents.length > 0 ? (
                              deliveryAgents.map(agent => (
                                <option key={agent.id} value={agent.agent_name}>
                                  {agent.agent_name}
                                </option>
                              ))
                            ) : (
                              <option value="DHL Courier">DHL Courier (Default)</option>
                            )}
                          </select>
                        ) : amendDispoType === 'Handover to OAL' ? (
                          <select
                            value={amendDispoValue}
                            onChange={(e) => setAmendDispoValue(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-705 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-semibold cursor-pointer"
                            required
                          >
                            <option value="">-- Choose Host/Carrier --</option>
                            {Object.entries(AIRLINE_NAMES).map(([code, name]) => (
                              <option key={code} value={`${code} - ${name}`}>
                                {code} - {name}
                              </option>
                            ))}
                            <option value="Star Alliance Partner">Star Alliance Partner</option>
                            <option value="OneWorld Carrier">OneWorld Carrier</option>
                            <option value="SkyTeam Host Carrier">SkyTeam Host Carrier</option>
                          </select>
                        ) : amendDispoType === 'Domestic forward' ? (
                          <input
                            type="text"
                            value={amendDispoValue}
                            onChange={(e) => setAmendDispoValue(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 text-slate-800 rounded-xl p-2.5 px-3 focus:outline-none text-xs font-medium font-mono"
                            placeholder="Forward details (Free text)"
                            required
                          />
                        ) : (
                          <select
                            value={amendDispoValue}
                            onChange={(e) => setAmendDispoValue(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-semibold cursor-pointer"
                            required
                          >
                            <option value="">-- Select State --</option>
                            <option value="Shortshipped / Left Behind">Shortshipped / Left Behind</option>
                            <option value="Misrouted Primary Hub">Misrouted Primary Hub</option>
                            <option value="Tracing Active Case">Tracing Active Case</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>

                  {amendDispoType && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-widest mb-1.5">
                        Free Text Remarks
                      </label>
                      <textarea
                        rows={2}
                        value={amendDispoRemarks}
                        onChange={(e) => setAmendDispoRemarks(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 text-slate-800 rounded-xl p-2.5 px-3 focus:outline-none text-xs text-slate-705"
                        placeholder="Provide custom remarks..."
                      />
                    </div>
                  )}
                </div>

                {/* Mandatory Reason Dropdown */}
                <div>
                  <label className="block text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Mandatory Compliance Reason Code
                  </label>
                  <select
                    value={amendReason}
                    onChange={(e) => setAmendReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-755 rounded-xl p-2.5 focus:outline-none text-xs font-bold focus:bg-white focus:border-blue-500 cursor-pointer"
                    required
                  >
                    <option value="Not cleared by customs">Not cleared by customs</option>
                    <option value="Damaged bag transition">Damaged bag transition</option>
                    <option value="Passenger claimed early">Passenger claimed early</option>
                    <option value="Routing sorting correction">Routing sorting correction</option>
                    <option value="Misloaded / Carousel split">Misloaded / Carousel split</option>
                    <option value="Other (provide comment)">Other (provide custom comment)</option>
                  </select>
                </div>

                {amendReason === 'Other (provide comment)' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Custom Audit Comment</label>
                    <textarea
                      value={customAmendReason}
                      onChange={(e) => setCustomAmendReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 h-16 text-xs font-mono focus:outline-none focus:bg-white focus:border-blue-500"
                      placeholder="Comment here..."
                      required
                    />
                  </div>
                )}

                {/* Flight Manifest Correction Fields */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/65 mt-3 space-y-3">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                    <span>FAA Flight Manifest Details</span>
                    <span className="text-[10px] text-slate-450 normal-case font-normal">(Correct if required)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">PIR Number</label>
                      <input
                        type="text"
                        value={amendPir}
                        onChange={(e) => setAmendPir(e.target.value)}
                        placeholder="e.g. PIR-LH-88201"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Passenger Name</label>
                      <input
                        type="text"
                        value={amendPassengerName}
                        onChange={(e) => setAmendPassengerName(e.target.value)}
                        placeholder="Passenger Name"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-widest mb-1">Original Tag No</label>
                      <input
                        type="text"
                        value={amendOriginalTag}
                        onChange={(e) => setAmendOriginalTag(e.target.value)}
                        placeholder="e.g. 0220123456"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-widest mb-1">Rush Tag No</label>
                      <input
                        type="text"
                        value={amendRushTag}
                        onChange={(e) => setAmendRushTag(e.target.value)}
                        placeholder="e.g. LH 900501"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-widest mb-1">Flight Number</label>
                      <input
                        type="text"
                        value={amendFlightNo}
                        onChange={(e) => setAmendFlightNo(e.target.value)}
                        placeholder="e.g. Flight No"
                        list="manifest-flights-list"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-widest mb-1">Seal Number</label>
                      <input
                        type="text"
                        value={amendSealNo}
                        onChange={(e) => setAmendSealNo(e.target.value)}
                        placeholder="e.g. S-712"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-widest mb-1">Destination Airport</label>
                      <input
                        type="text"
                        value={amendDestination}
                        onChange={(e) => setAmendDestination(e.target.value)}
                        placeholder="e.g. FRA, CDG, ORD"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-widest mb-1">Remarks/Amendments</label>
                      <textarea
                        rows={2}
                        value={amendRemarks}
                        onChange={(e) => setAmendRemarks(e.target.value)}
                        placeholder="Provide specific notes..."
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingBag(null)}
                    className="bg-slate-100 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition hover:bg-slate-200 border border-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    Amend Record & Sign Audit Trail
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SOFT DELETION DISREGARD MODAL */}
      <AnimatePresence>
        {deletingBag && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 shadow-2xl relative"
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-red-600 font-bold">Compliance Regulation Strike</span>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    Strike Records for: <span className="font-mono text-blue-600">{deletingBag.alpha_tag}</span>
                  </h3>
                </div>
                <button
                  onClick={() => setDeletingBag(null)}
                  className="text-slate-400 hover:text-slate-850 font-mono font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleDeleteBag} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  Striked baggage records are soft-deleted from the main registry views but preserved indelibly in the non-destructive system logs for safety audits.
                </p>

                {/* Mandatory Reason Dropdown */}
                <div>
                  <label className="block text-[10px] font-bold text-red-650 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    Mandatory Reason for Deletion
                  </label>
                  <select
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-750 font-semibold rounded-xl p-2.5 focus:outline-none text-xs focus:bg-white focus:border-blue-500 cursor-pointer"
                    required
                  >
                    <option value="Passenger claimed early">Passenger claimed early</option>
                    <option value="Manifest duplicate mistake">Manifest duplicate mistake</option>
                    <option value="Damaged beyond recovery - scrapped">Damaged beyond recovery - scrapped</option>
                    <option value="Returned to boarding hub">Returned to boarding hub</option>
                    <option value="Other (provide comment)">Other (provide custom comment)</option>
                  </select>
                </div>

                {deleteReason === 'Other (provide comment)' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Custom Audit Comment Log</label>
                    <textarea
                      value={customDeleteReason}
                      onChange={(e) => setCustomDeleteReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 h-16 text-xs font-mono focus:outline-none focus:bg-white focus:border-blue-500"
                      placeholder="Comment here..."
                      required
                    />
                  </div>
                )}

                {/* Admin Only Physical Deletion (Purge) Option */}
                {deletingBag.dispo_type && (
                  <div className="border-t border-slate-150 pt-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs uppercase tracking-wider">
                      <ShieldAlert className="h-4 w-4" />
                      <span>Admin Purge Control</span>
                    </div>
                    <p className="text-[11px] text-slate-505 leading-relaxed font-semibold">
                      This passenger record already features a registered Baggage Disposition (<strong>{deletingBag.dispo_type}</strong>: {deletingBag.dispo_value}). You can completely expunge and purge this passenger from both active and backup datasets of the registry.
                    </p>
                    
                    {!isAdmin ? (
                      <div className="text-[10px] text-amber-600 font-semibold bg-amber-50 rounded-lg p-2.5 border border-amber-200/50 flex items-center gap-1 justify-center">
                        <Lock className="h-3 w-3 shrink-0" />
                        Admin Sign-in required to purge passenger database entries.
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePurgeBag(deletingBag)}
                        className="w-full text-center bg-rose-600 hover:bg-rose-750 text-white font-bold py-2 px-3 rounded-xl transition text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-xs font-mono"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        EXPUNGE & PURGE COMPLETELY
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingBag(null)}
                    className="bg-slate-100 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition hover:bg-slate-200 border border-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Trash className="h-3 w-3" />
                    Strike record & Log deletion
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CAMERA SCANNER MODAL */}
      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative"
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 font-bold animate-pulse">Hardware Camera Stream Active</span>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    <ScanLine className="h-5 w-5 text-blue-600" />
                    Live Baggage Barcode Scanner
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={stopCameraScan}
                  className="text-slate-400 hover:text-slate-800 font-semibold font-mono text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Active scan frame box */}
                <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-video border border-slate-805 flex flex-col items-center justify-center shadow-inner">
                  {/* Viewport for html5-qrcode */}
                  <div id="scanner-viewport" className="absolute inset-0 w-full h-full object-cover" />
                  
                  {/* Scanner scan-line visualization overlay if no error */}
                  {!scannerError && (
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 border border-blue-500/50 bg-blue-500/5 h-[40%] rounded-md flex items-center justify-center pointer-events-none">
                      <div className="w-[102%] h-[2px] bg-red-500 animate-pulse relative shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                      <span className="absolute bottom-2 text-[10px] bg-slate-900/80 text-blue-400 font-mono tracking-widest px-2 py-0.5 rounded border border-blue-500/20">
                        ALIGN 1D BARCODE OR QR CODE
                      </span>
                    </div>
                  )}

                  {scannerError && (
                    <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-900 z-10 space-y-3">
                      <CameraOff className="h-10 w-10 text-red-500" />
                      <p className="text-xs font-bold text-slate-350 max-w-xs">{scannerError}</p>
                      <button
                        type="button"
                        onClick={() => startCameraScan(selectedCameraId)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition cursor-pointer"
                      >
                        Retry Camera Connection
                      </button>
                    </div>
                  )}
                </div>

                {/* Camera Switching Controls */}
                {cameras.length > 1 && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Choose Scanner Camera Input
                    </label>
                    <select
                      value={selectedCameraId}
                      onChange={(e) => startCameraScan(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-705 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:border-blue-500 cursor-pointer"
                    >
                      {cameras.map((camera) => (
                        <option key={camera.id} value={camera.id}>
                          {camera.label || `Camera ${camera.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-650 text-xs leading-relaxed flex items-center gap-3 shadow-xs">
                  <HelpCircle className="h-5 w-5 text-blue-600 shrink-0" />
                  <span>
                    Hold the baggage paper license tag level and centered. The system reads and converts both numeric 10-digit barcodes and alpha-equivalent tags in real time.
                  </span>
                </div>

                <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={stopCameraScan}
                    className="bg-slate-100 text-slate-600 font-bold text-xs py-2.5 px-4 rounded-xl transition hover:bg-slate-200 border border-slate-200 cursor-pointer"
                  >
                    Close Scanner
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADMIN SIGN-IN MODAL */}
      <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative"
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-rose-600 font-bold flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Authorized Access Only
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    Admin Authentication
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false);
                    setAdminUsername('');
                    setAdminPassword('');
                    setAdminError(null);
                  }}
                  className="text-slate-400 hover:text-slate-805 font-mono font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAdminSignIn} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  Please enter the administrative credentials to modify location slots, delivery agents, and passenger databases.
                </p>

                {adminError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-bounce">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    <span>{adminError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 text-slate-800 rounded-xl p-2.5 text-xs font-semibold focus:outline-none"
                    placeholder="e.g. admin"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 text-slate-800 rounded-xl p-2.5 text-xs font-semibold focus:outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminModal(false);
                      setAdminUsername('');
                      setAdminPassword('');
                      setAdminError(null);
                    }}
                    className="bg-slate-100 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition hover:bg-slate-200 border border-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-xs font-mono"
                  >
                    <Unlock className="h-3 w-3" />
                    Sign In
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM SECURITY CONFIRMATION DIALOG (IFRAME-FRIENDLY) */}
      <AnimatePresence>
        {customConfirmState.isOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative space-y-4"
            >
              <div className="flex items-start gap-4 border-b border-slate-100 pb-3">
                <div className="p-2.5 bg-amber-50 border border-amber-200/60 rounded-xl text-amber-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                    System Confirmation
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                    {customConfirmState.title}
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                {customConfirmState.message}
              </p>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCustomConfirmState(prev => ({ ...prev, isOpen: false }))}
                  className="bg-slate-100 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition hover:bg-slate-200 border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customConfirmState.onConfirm) {
                      customConfirmState.onConfirm();
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-xs font-mono"
                >
                  {customConfirmState.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <datalist id="manifest-flights-list">
        {activeFlightOptions.map(flight => (
          <option key={flight} value={flight} />
        ))}
      </datalist>
    </div>
  );
}
