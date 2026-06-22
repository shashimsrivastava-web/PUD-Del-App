import fs from 'fs';
import path from 'path';

export interface BaggageItem {
  id: string;
  universal_tag: string;
  alpha_tag: string;
  current_location_id: string;
  status: string; // 'Scanned' | 'Damaged' | 'Customs Hold' | 'In Transit' | 'Delivered' | 'Deleted' | 'DID NOT ARRIVE'
  airline_name: string;
  serial_number: string;
  is_deleted?: boolean;
  updated_at: string;
  dispo_type?: 'Storage Location' | 'Delivery Agent' | 'Handover to OAL' | 'Domestic forward' | 'DID NOT ARRIVE' | '';
  dispo_value?: string;
  dispo_remarks?: string;
  pir?: string;
  passenger_name?: string;
  original_tag?: string;
  rush_tag?: string;
  flight_no?: string;
  seal_no?: string;
  destination?: string;
  remarks?: string;
}

export interface LocationItem {
  id: string;
  location_name: string;
  location_type: 'Delivery' | 'Storage';
  qr_code_hash: string;
}

export interface DeliveryAgentItem {
  id: string;
  agent_name: string;
}

export interface AuditLog {
  id: string;
  bag_id: string;
  universal_tag: string;
  alpha_tag: string;
  previous_location_id: string | null;
  previous_location_name: string | null;
  new_location_id: string | null;
  new_location_name: string | null;
  reason: string;
  agent_id: string; // Operator / User email
  timestamp: string;
}

export interface ManifestRow {
  id: string;
  pir: string;
  passenger_name: string;
  original_tag: string;
  rush_tag: string;
  flight_no: string;
  seal_no: string;
  destination: string;
  remarks: string;
}

export interface ManifestItem {
  id: string;
  flight_number: string;
  expected_tags: string[]; // List of expected universal tag values
  upload_timestamp: string;
  airline_code?: string;
  rows?: ManifestRow[];
}

export interface DatabaseState {
  baggage_items: BaggageItem[];
  locations: LocationItem[];
  audit_logs: AuditLog[];
  manifests: ManifestItem[];
  delivery_agents: DeliveryAgentItem[];
  allowed_flights: string[];
}

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

const DEFAULT_LOCATIONS: LocationItem[] = [
  { id: 'loc-1', location_name: 'Warehouse A', location_type: 'Storage', qr_code_hash: 'hash-warehouse-a' },
  { id: 'loc-2', location_name: 'Arrival Hall B', location_type: 'Storage', qr_code_hash: 'hash-arrival-hall-b' },
  { id: 'loc-3', location_name: 'Terminal 1 Reclaim', location_type: 'Delivery', qr_code_hash: 'hash-t1-reclaim' },
  { id: 'loc-4', location_name: 'Terminal 2 Carousel', location_type: 'Delivery', qr_code_hash: 'hash-t2-carousel' },
  { id: 'loc-5', location_name: 'Customs Holding Area', location_type: 'Storage', qr_code_hash: 'hash-customs-hold' },
  { id: 'loc-6', location_name: 'Outbound Sorting Dock', location_type: 'Delivery', qr_code_hash: 'hash-sorting-dock' },
];

const INITIAL_STATE: DatabaseState = {
  baggage_items: [
    {
      id: 'bag-1',
      universal_tag: '0220123456',
      alpha_tag: 'LH 123456',
      current_location_id: 'loc-1',
      status: 'Scanned',
      airline_name: 'Lufthansa',
      serial_number: '123456',
      updated_at: '2026-06-22T00:10:00.000Z',
    },
    {
      id: 'bag-2',
      universal_tag: '0016456789',
      alpha_tag: 'UA 456789',
      current_location_id: 'loc-3',
      status: 'Delivered',
      airline_name: 'United Airlines',
      serial_number: '456789',
      updated_at: '2026-06-22T01:00:00.000Z',
    },
    {
      id: 'bag-3',
      universal_tag: '0006789012',
      alpha_tag: 'DL 789012',
      current_location_id: 'loc-5',
      status: 'Customs Hold',
      airline_name: 'Delta Air Lines',
      serial_number: '789012',
      updated_at: '2026-06-22T01:05:00.000Z',
    }
  ],
  locations: DEFAULT_LOCATIONS,
  audit_logs: [
    {
      id: 'log-1',
      bag_id: 'bag-1',
      universal_tag: '0220123456',
      alpha_tag: 'LH 123456',
      previous_location_id: null,
      previous_location_name: null,
      new_location_id: 'loc-1',
      new_location_name: 'Warehouse A',
      reason: 'Initial Scanning',
      agent_id: 'john.operator@aviation.com',
      timestamp: '2026-06-22T00:10:00.000Z'
    },
    {
      id: 'log-2',
      bag_id: 'bag-2',
      universal_tag: '0016456789',
      alpha_tag: 'UA 456789',
      previous_location_id: null,
      previous_location_name: null,
      new_location_id: 'loc-2',
      new_location_name: 'Arrival Hall B',
      reason: 'Initial Scanning',
      agent_id: 'sarah.reception@aviation.com',
      timestamp: '2026-06-21T23:50:00.000Z'
    },
    {
      id: 'log-3',
      bag_id: 'bag-2',
      universal_tag: '0016456789',
      alpha_tag: 'UA 456789',
      previous_location_id: 'loc-2',
      previous_location_name: 'Arrival Hall B',
      new_location_id: 'loc-3',
      new_location_name: 'Terminal 1 Reclaim',
      reason: 'Released for pickup',
      agent_id: 'sarah.reception@aviation.com',
      timestamp: '2026-06-22T01:00:00.000Z'
    }
  ],
  manifests: [
    {
      id: 'mnf-1',
      flight_number: 'LH 430',
      expected_tags: ['0220123456', '0220123457', '0220123458', '0220888999'],
      upload_timestamp: '2026-06-22T00:05:00.000Z',
      airline_code: 'LH'
    }
  ],
  delivery_agents: [
    { id: 'agent-1', agent_name: 'DHL Express' },
    { id: 'agent-2', agent_name: 'FedEx Aero' },
    { id: 'agent-3', agent_name: 'Local Courier Prime' },
    { id: 'agent-4', agent_name: 'Airport Ground Logistics' }
  ],
  allowed_flights: ['LH760', 'LH762', 'LX146', 'LX2646', 'OAL', 'Level 4']
};

// Ensure db directory or DB file exists
function ensureDirAndFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_STATE, null, 2), 'utf-8');
  }
}

export function readDatabase(): DatabaseState {
  ensureDirAndFile();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content) as DatabaseState;
    let modified = false;
    if (!parsed.delivery_agents) {
      parsed.delivery_agents = [
        { id: 'agent-1', agent_name: 'DHL Express' },
        { id: 'agent-2', agent_name: 'FedEx Aero' },
        { id: 'agent-3', agent_name: 'Local Courier Prime' },
        { id: 'agent-4', agent_name: 'Airport Ground Logistics' }
      ];
      modified = true;
    }
    if (!parsed.allowed_flights) {
      parsed.allowed_flights = ['LH760', 'LH762', 'LX146', 'LX2646', 'OAL', 'Level 4'];
      modified = true;
    }
    if (modified) {
      writeDatabase(parsed);
    }
    return parsed;
  } catch (error) {
    console.error('Failed reading JSON database, returning fallback state', error);
    return INITIAL_STATE;
  }
}

export function writeDatabase(state: DatabaseState): void {
  ensureDirAndFile();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed writing JSON database', error);
  }
}
