import { NextRequest, NextResponse } from 'next/server';
import { readDatabase, writeDatabase, BaggageItem, AuditLog, LocationItem, ManifestItem, DatabaseState, ManifestRow } from '@/lib/db-store';
import { parseBagTag } from '@/lib/baggageParser';

export async function GET(req: NextRequest) {
  try {
    const db = await readDatabase();
    // Return non-deleted items to general queries
    const activeBaggage = db.baggage_items.filter(item => !item.is_deleted);
    return NextResponse.json({ 
      success: true, 
      data: {
        ...db,
        baggage_items: activeBaggage,
        all_baggage_items_raw: db.baggage_items // includes soft-deleted for audits or supervisors
      } 
    });
  } catch (error) {
    console.error('GET API Failure:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve baggage database state' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const db = await readDatabase();
    
    if (action === 'register_bag') {
      const { rawTag, locationId, status, agentId, dispoType, dispoValue, dispoRemarks } = body;
      if (!rawTag || !locationId || !status || !agentId) {
        return NextResponse.json({ success: false, error: 'Missing required parameters: Tag, Location, Status, and Operator' }, { status: 400 });
      }
      
      const parsed = parseBagTag(rawTag);
      if (!parsed) {
        return NextResponse.json({ success: false, error: 'Invalid bag tag alphanumeric format.' }, { status: 400 });
      }
      
      // Look up if location is valid (except for "DID NOT ARRIVE" which can stay location-independent or mock)
      const targetLocation = db.locations.find(l => l.id === locationId);
      if (!targetLocation) {
        return NextResponse.json({ success: false, error: 'Dynamic target storage location was not found' }, { status: 400 });
      }

      // Look up additional fields from request body OR auto-fill match from manifests if vacant
      let pir = body.pir || '';
      let passenger_name = body.passenger_name || body.name || '';
      let original_tag = body.original_tag || '';
      let rush_tag = body.rush_tag || '';
      let flight_no = body.flight_no || '';
      let seal_no = body.seal_no || '';
      let destination = body.destination || '';
      let remarks = body.remarks || '';

      // Auto-fill from structured manifest if blank
      if (!pir && !passenger_name && !original_tag) {
        for (const manifest of db.manifests) {
          if (manifest.rows) {
            const rowMatch = manifest.rows.find(row => {
              const rowOrig = parseBagTag(row.original_tag);
              const rowRush = parseBagTag(row.rush_tag);
              const rowOrigTag = rowOrig ? rowOrig.universalTag : row.original_tag;
              const rowRushTag = rowRush ? rowRush.universalTag : row.rush_tag;
              
              return rowOrigTag === parsed.universalTag || 
                     rowRushTag === parsed.universalTag || 
                     row.original_tag === rawTag || 
                     row.rush_tag === rawTag;
            });

            if (rowMatch) {
              pir = rowMatch.pir;
              passenger_name = rowMatch.passenger_name;
              original_tag = rowMatch.original_tag;
              rush_tag = rowMatch.rush_tag;
              flight_no = rowMatch.flight_no;
              seal_no = rowMatch.seal_no;
              destination = rowMatch.destination;
              remarks = rowMatch.remarks;
              break;
            }
          }
        }
      }
      
      // Search matching baggage based on universal_tag equivalence!
      const existingBagIndex = db.baggage_items.findIndex(b => b.universal_tag === parsed.universalTag);
      
      let bagId: string;
      let prevLocationId: string | null = null;
      let prevLocationName: string | null = null;
      let logReason = 'Initial Scanning';
      
      if (existingBagIndex >= 0) {
        const existingBag = db.baggage_items[existingBagIndex];
        
        if (existingBag.is_deleted) {
          // Reactivate soft-deleted
          existingBag.is_deleted = false;
          existingBag.status = status;
          prevLocationId = null;
          prevLocationName = null;
          logReason = 'Reactivated bag tag scanning';
        } else {
          // Move / Update existing
          prevLocationId = existingBag.current_location_id;
          const oldLoc = db.locations.find(l => l.id === prevLocationId);
          prevLocationName = oldLoc ? oldLoc.location_name : 'Unknown';
          
          if (existingBag.current_location_id !== locationId) {
            logReason = body.reason || 'Location changed during scan registration';
          } else {
            logReason = 'Status/Carrier update via scanner';
          }
        }
        
        existingBag.current_location_id = locationId;
        existingBag.status = status;
        existingBag.updated_at = new Date().toISOString();
        existingBag.dispo_type = dispoType !== undefined ? dispoType : (existingBag.dispo_type || '');
        existingBag.dispo_value = dispoValue !== undefined ? dispoValue : (existingBag.dispo_value || '');
        existingBag.dispo_remarks = dispoRemarks !== undefined ? dispoRemarks : (existingBag.dispo_remarks || '');
        
        // Update manifest details
        if (pir) existingBag.pir = pir;
        if (passenger_name) existingBag.passenger_name = passenger_name;
        if (original_tag) existingBag.original_tag = original_tag;
        if (rush_tag) existingBag.rush_tag = rush_tag;
        if (flight_no) existingBag.flight_no = flight_no;
        if (seal_no) existingBag.seal_no = seal_no;
        if (destination) existingBag.destination = destination;
        if (remarks) existingBag.remarks = remarks;

        bagId = existingBag.id;
      } else {
        // Create brand new item
        bagId = 'bag-' + Date.now();
        const newBag: BaggageItem = {
          id: bagId,
          universal_tag: parsed.universalTag,
          alpha_tag: parsed.alphaTag,
          current_location_id: locationId,
          status: status,
          airline_name: parsed.airlineName,
          serial_number: parsed.serialNumber,
          updated_at: new Date().toISOString(),
          dispo_type: dispoType || '',
          dispo_value: dispoValue || '',
          dispo_remarks: dispoRemarks || '',
          pir,
          passenger_name,
          original_tag,
          rush_tag,
          flight_no,
          seal_no,
          destination,
          remarks
        };
        db.baggage_items.push(newBag);
      }
      
      // Create Audit Log
      const auditLog: AuditLog = {
        id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        bag_id: bagId,
        universal_tag: parsed.universalTag,
        alpha_tag: parsed.alphaTag,
        previous_location_id: prevLocationId,
        previous_location_name: prevLocationName,
        new_location_id: locationId,
        new_location_name: targetLocation.location_name,
        reason: logReason,
        agent_id: agentId,
        timestamp: new Date().toISOString()
      };
      
      db.audit_logs.push(auditLog);
      await writeDatabase(db);
      
      return NextResponse.json({ success: true, baggage_item: db.baggage_items.find(b => b.id === bagId) });
    }
    
    if (action === 'edit_bag') {
      const { bagId, locationId, status, reason, agentId, dispoType, dispoValue, dispoRemarks } = body;
      if (!bagId || !locationId || !status || !reason || !agentId) {
        return NextResponse.json({ success: false, error: 'Missing mandatory fields: bag identifier, location, status, reason code, operator ID' }, { status: 400 });
      }
      
      const bagIndex = db.baggage_items.findIndex(b => b.id === bagId);
      if (bagIndex < 0) {
        return NextResponse.json({ success: false, error: 'Target baggage item does not exist in registry' }, { status: 404 });
      }
      
      const bag = db.baggage_items[bagIndex];
      const prevLocationId = bag.current_location_id;
      const oldLoc = db.locations.find(l => l.id === prevLocationId);
      const prevLocationName = oldLoc ? oldLoc.location_name : 'Unknown';
      
      const newLoc = db.locations.find(l => l.id === locationId);
      if (!newLoc) {
        return NextResponse.json({ success: false, error: 'Target storage/delivery location not found' }, { status: 404 });
      }
      
      const locationChanged = prevLocationId !== locationId;
      const statusChanged = bag.status !== status;
      const dispoTypeChanged = dispoType !== undefined && bag.dispo_type !== dispoType;
      const dispoValueChanged = dispoValue !== undefined && bag.dispo_value !== dispoValue;
      const dispoRemarksChanged = dispoRemarks !== undefined && bag.dispo_remarks !== dispoRemarks;
      
      const extraFieldsChanged = 
        (body.pir !== undefined && bag.pir !== body.pir) ||
        (body.passenger_name !== undefined && bag.passenger_name !== body.passenger_name) ||
        (body.original_tag !== undefined && bag.original_tag !== body.original_tag) ||
        (body.rush_tag !== undefined && bag.rush_tag !== body.rush_tag) ||
        (body.flight_no !== undefined && bag.flight_no !== body.flight_no) ||
        (body.seal_no !== undefined && bag.seal_no !== body.seal_no) ||
        (body.destination !== undefined && bag.destination !== body.destination) ||
        (body.remarks !== undefined && bag.remarks !== body.remarks);

      if (!locationChanged && !statusChanged && !dispoTypeChanged && !dispoValueChanged && !dispoRemarksChanged && !extraFieldsChanged) {
        return NextResponse.json({ success: true, message: 'Registry and status matches existing values, no amendment needed' });
      }
      
      bag.current_location_id = locationId;
      bag.status = status;
      bag.updated_at = new Date().toISOString();
      if (dispoType !== undefined) bag.dispo_type = dispoType;
      if (dispoValue !== undefined) bag.dispo_value = dispoValue;
      if (dispoRemarks !== undefined) bag.dispo_remarks = dispoRemarks;
      
      if (body.pir !== undefined) bag.pir = body.pir;
      if (body.passenger_name !== undefined) bag.passenger_name = body.passenger_name;
      if (body.original_tag !== undefined) bag.original_tag = body.original_tag;
      if (body.rush_tag !== undefined) bag.rush_tag = body.rush_tag;
      if (body.flight_no !== undefined) bag.flight_no = body.flight_no;
      if (body.seal_no !== undefined) bag.seal_no = body.seal_no;
      if (body.destination !== undefined) bag.destination = body.destination;
      if (body.remarks !== undefined) bag.remarks = body.remarks;
      
      const auditLog: AuditLog = {
        id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        bag_id: bagId,
        universal_tag: bag.universal_tag,
        alpha_tag: bag.alpha_tag,
        previous_location_id: locationChanged ? prevLocationId : null,
        previous_location_name: locationChanged ? prevLocationName : null,
        new_location_id: locationId,
        new_location_name: newLoc.location_name,
        reason: reason, // Mandatory Reason code is tracked here securely!
        agent_id: agentId,
        timestamp: new Date().toISOString()
      };
      
      db.audit_logs.push(auditLog);
      await writeDatabase(db);
      
      return NextResponse.json({ success: true, baggage_item: bag });
    }
    
    if (action === 'delete_bag') {
      const { bagId, reason, agentId } = body;
      if (!bagId || !reason || !agentId) {
        return NextResponse.json({ success: false, error: 'Reason for deletion and Operator ID are mandatory for regulatory compliance' }, { status: 400 });
      }
      
      const bagIndex = db.baggage_items.findIndex(b => b.id === bagId);
      if (bagIndex < 0) {
        return NextResponse.json({ success: false, error: 'Baggage item not found in records' }, { status: 404 });
      }
      
      const bag = db.baggage_items[bagIndex];
      bag.is_deleted = true;
      bag.updated_at = new Date().toISOString();
      
      const oldLoc = db.locations.find(l => l.id === bag.current_location_id);
      
      // Retain the baggage record but write a hard record to the audit trail
      const auditLog: AuditLog = {
        id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        bag_id: bagId,
        universal_tag: bag.universal_tag,
        alpha_tag: bag.alpha_tag,
        previous_location_id: bag.current_location_id,
        previous_location_name: oldLoc ? oldLoc.location_name : 'Unknown',
        new_location_id: null,
        new_location_name: null,
        reason: `DELETION: ${reason}`,
        agent_id: agentId,
        timestamp: new Date().toISOString()
      };
      
      db.audit_logs.push(auditLog);
      await writeDatabase(db);
      
      return NextResponse.json({ success: true, message: 'Baggage item historically saved with deletion code logged.' });
    }

    if (action === 'purge_bag') {
      const { bagId, agentId } = body;
      if (!bagId) {
        return NextResponse.json({ success: false, error: 'Bag identifier is required for physical purge.' }, { status: 400 });
      }
      
      const bagIndex = db.baggage_items.findIndex(b => b.id === bagId);
      if (bagIndex < 0) {
        return NextResponse.json({ success: false, error: 'Baggage record not found' }, { status: 404 });
      }
      
      const bag = db.baggage_items[bagIndex];
      db.baggage_items.splice(bagIndex, 1);
      
      const auditLog: AuditLog = {
        id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        bag_id: bagId,
        universal_tag: bag.universal_tag,
        alpha_tag: bag.alpha_tag,
        previous_location_id: bag.current_location_id,
        previous_location_name: 'Database Active',
        new_location_id: null,
        new_location_name: null,
        reason: 'PURGED FROM SYSTEM (HARD DELETED BY ADMIN)',
        agent_id: agentId || 'admin',
        timestamp: new Date().toISOString()
      };
      
      db.audit_logs.push(auditLog);
      await writeDatabase(db);
      
      return NextResponse.json({ success: true, message: 'Baggage item was permanently purged from the database.' });
    }
    
    if (action === 'create_location') {
      const { name, type } = body;
      if (!name || (type !== 'Delivery' && type !== 'Storage')) {
        return NextResponse.json({ success: false, error: 'Invalid name or location type (must be Storage or Delivery)' }, { status: 400 });
      }
      
      const exists = db.locations.some(l => l.location_name.toLowerCase() === name.trim().toLowerCase());
      if (exists) {
        return NextResponse.json({ success: false, error: 'A location with this name is already registered in the registry' }, { status: 400 });
      }
      
      const customId = 'loc-' + Date.now();
      const newLoc = {
        id: customId,
        location_name: name.trim(),
        location_type: type,
        qr_code_hash: `hash-${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      };
      db.locations.push(newLoc);
      await writeDatabase(db);
      
      return NextResponse.json({ success: true, location: newLoc });
    }

    if (action === 'delete_location') {
      const { locationId } = body;
      const index = db.locations.findIndex(l => l.id === locationId);
      if (index < 0) {
        return NextResponse.json({ success: false, error: 'Target location not found' }, { status: 404 });
      }
      
      db.locations.splice(index, 1);
      await writeDatabase(db);
      
      return NextResponse.json({ success: true });
    }

    if (action === 'create_delivery_agent') {
      const { name } = body;
      if (!name || !name.trim()) {
        return NextResponse.json({ success: false, error: 'Agent name is required' }, { status: 400 });
      }
      
      const exists = db.delivery_agents.some(a => a.agent_name.toLowerCase() === name.trim().toLowerCase());
      if (exists) {
        return NextResponse.json({ success: false, error: 'A delivery agent with this name is already registered.' }, { status: 400 });
      }
      
      const newAgent = {
        id: 'agent-' + Date.now(),
        agent_name: name.trim()
      };
      db.delivery_agents.push(newAgent);
      await writeDatabase(db);
      
      return NextResponse.json({ success: true, agent: newAgent });
    }

    if (action === 'delete_delivery_agent') {
      const { agentId } = body;
      const index = db.delivery_agents.findIndex(a => a.id === agentId);
      if (index < 0) {
        return NextResponse.json({ success: false, error: 'Target delivery agent not found' }, { status: 404 });
      }
      
      db.delivery_agents.splice(index, 1);
      await writeDatabase(db);
      
      return NextResponse.json({ success: true });
    }
    
    if (action === 'upload_manifest') {
      const { flightNumber, tags, rows } = body;
      
      let finalExpectedTags: string[] = [];
      let finalRows: ManifestRow[] = [];
      
      const existingTags = new Set<string>();
      db.manifests.forEach(m => {
        if (m.expected_tags) {
          m.expected_tags.forEach(t => existingTags.add(t));
        }
      });
      const currentUploadTags = new Set<string>();
      let duplicatesFound = 0;
      
      if (rows && Array.isArray(rows)) {
        const tempRows = rows.map((r, i) => ({
          id: r.id || `row-${Date.now()}-${i}`,
          pir: r.pir || '',
          passenger_name: r.passenger_name || r.name || '',
          original_tag: r.original_tag || '',
          rush_tag: r.rush_tag || '',
          flight_no: r.flight_no || flightNumber || '',
          seal_no: r.seal_no || '',
          destination: r.destination || '',
          remarks: r.remarks || ''
        }));
        
        tempRows.forEach(row => {
          let hasDuplicate = false;
          let rTags: string[] = [];
          
          if (row.original_tag && row.original_tag.trim() !== '' && !['N/A', 'NONE', '-'].includes(row.original_tag.trim().toUpperCase())) {
            const p = parseBagTag(row.original_tag);
            rTags.push(p ? p.universalTag : row.original_tag.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
          }
          if (row.rush_tag && row.rush_tag.trim() !== '' && !['N/A', 'NONE', '-'].includes(row.rush_tag.trim().toUpperCase())) {
            const p = parseBagTag(row.rush_tag);
            rTags.push(p ? p.universalTag : row.rush_tag.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
          }
          
          rTags.forEach(tag => {
            if (existingTags.has(tag) || currentUploadTags.has(tag)) {
              hasDuplicate = true;
            }
          });
          
          if (hasDuplicate) {
            duplicatesFound++;
          } else {
            rTags.forEach(tag => {
               currentUploadTags.add(tag);
               finalExpectedTags.push(tag);
            });
            finalRows.push(row);
          }
        });
      } else if (tags && Array.isArray(tags)) {
        // Fallback or simple copy-paste standard parsing
        tags.forEach((t, i) => {
          if (!t || t.trim() === '' || ['N/A', 'NONE', '-'].includes(t.trim().toUpperCase())) return;
          const p = parseBagTag(t);
          const uTag = p ? p.universalTag : t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          if (existingTags.has(uTag) || currentUploadTags.has(uTag)) {
            duplicatesFound++;
          } else {
            currentUploadTags.add(uTag);
            finalExpectedTags.push(uTag);
            finalRows.push({
              id: `row-${Date.now()}-${i}`,
              pir: `PIR-GEN-${10000 + i}`,
              passenger_name: `Passenger ${i + 1}`,
              original_tag: t,
              rush_tag: '',
              flight_no: flightNumber || 'GENERIC',
              seal_no: `S-${100 + i}`,
              destination: 'ORD',
              remarks: 'Imported via simple tag list'
            });
          }
        });
      } else {
        return NextResponse.json({ success: false, error: 'Flight identifier and tag rows are required for flight manifest validation' }, { status: 400 });
      }
      
      if (finalExpectedTags.length === 0) {
        return NextResponse.json({ success: false, error: `The uploaded file does not contain any readable airline baggage tags. ${duplicatesFound > 0 ? (duplicatesFound + ' duplicate records were rejected.') : ''}` }, { status: 400 });
      }
      
      const newManifest: ManifestItem = {
        id: 'mnf-' + Date.now(),
        flight_number: flightNumber.trim().toUpperCase(),
        expected_tags: finalExpectedTags,
        upload_timestamp: new Date().toISOString(),
        airline_code: flightNumber.trim().slice(0, 2).toUpperCase(),
        rows: finalRows
      };
      
      const totalRecords = rows ? rows.length : (tags ? tags.length : 0);
      const uploadedRecords = finalRows.length;
      
      db.manifests.push(newManifest);
      await writeDatabase(db);
      
      return NextResponse.json({ 
        success: true, 
        manifest: newManifest, 
        totalRecords, 
        uploadedRecords,
        duplicatesRejected: duplicatesFound 
      });
    }

    if (action === 'update_manifest_row') {
      const { manifestId, row } = body;
      const manifestIndex = db.manifests.findIndex(m => m.id === manifestId);
      if (manifestIndex < 0) {
        return NextResponse.json({ success: false, error: 'Manifest not found' }, { status: 404 });
      }

      const m = db.manifests[manifestIndex];
      
      // If we are editing for the first time and we only had expected_tags, hydrate m.rows
      if (!m.rows || m.rows.length === 0) {
        m.rows = m.expected_tags.map((tag, idx) => {
          return {
            id: `row-fallback-${idx}-${m.id}`,
            pir: `PIR-${m.airline_code || 'XX'}-${88200 + idx}`,
            passenger_name: `Passenger Box ${idx + 1}`,
            original_tag: tag,
            rush_tag: '',
            flight_no: m.flight_number || '',
            seal_no: `S-71${idx}`,
            destination: 'FRA',
            remarks: 'Simple tag import list'
          };
        });
      }
      
      const rowIndex = m.rows.findIndex(r => r.id === row.id);
      
      if (rowIndex >= 0) {
        // Update existing row
        m.rows[rowIndex] = { ...m.rows[rowIndex], ...row };
      } else {
        // Create as new row if it didn't exist 
        const newRow = {
          id: row.id.startsWith('gen-') || row.id.startsWith('row-fallback-') ? `row-${Date.now()}-${Math.floor(Math.random() * 1000)}` : row.id,
          pir: row.pir || '',
          passenger_name: row.passenger_name || '',
          original_tag: row.original_tag || '',
          rush_tag: row.rush_tag || '',
          flight_no: row.flight_no || m.flight_number || '',
          seal_no: row.seal_no || '',
          destination: row.destination || '',
          remarks: row.remarks || ''
        };
        m.rows.push(newRow);
      }
      
      // Regenerate expected_tags for the manifest because tags might have changed
      const newExpectedTags: string[] = [];
      m.rows.forEach(r => {
        if (r.original_tag) {
          const p = parseBagTag(r.original_tag);
          newExpectedTags.push(p ? p.universalTag : r.original_tag);
        }
        if (r.rush_tag) {
          const p = parseBagTag(r.rush_tag);
          newExpectedTags.push(p ? p.universalTag : r.rush_tag);
        }
      });
      m.expected_tags = [...new Set(newExpectedTags)];
      
      await writeDatabase(db);
      return NextResponse.json({ success: true, manifest: m });
    }

    if (action === 'delete_manifest_rows') {
      const { manifestId, rowIds } = body;
      const manifestIndex = db.manifests.findIndex(m => m.id === manifestId);
      if (manifestIndex < 0) {
        return NextResponse.json({ success: false, error: 'Manifest not found' }, { status: 404 });
      }

      const m = db.manifests[manifestIndex];
      let updated = false;

      // Handle simple tags if the id format matches row-fallback-idx-manifestId
      if (rowIds.some((id: string) => id.startsWith('row-fallback-'))) {
        const fallbackIndices = rowIds
          .filter((id: string) => id.startsWith('row-fallback-'))
          .map((id: string) => parseInt(id.split('-')[2], 10))
          .filter((idx: number) => !isNaN(idx));
          
        if (fallbackIndices.length > 0) {
          m.expected_tags = m.expected_tags.filter((_, idx) => !fallbackIndices.includes(idx));
          updated = true;
        }
      }

      if (m.rows) {
        m.rows = m.rows.filter(r => !rowIds.includes(r.id));
        
        // Re-sync expected_tags for detailed rows
        const newExpectedTags: string[] = [];
        m.rows.forEach(r => {
          if (r.original_tag) {
            const p = parseBagTag(r.original_tag);
            newExpectedTags.push(p ? p.universalTag : r.original_tag);
          }
          if (r.rush_tag) {
            const p = parseBagTag(r.rush_tag);
            newExpectedTags.push(p ? p.universalTag : r.rush_tag);
          }
        });
        m.expected_tags = [...new Set(newExpectedTags)];
        updated = true;
      }
      
      if (updated) {
        await writeDatabase(db);
        return NextResponse.json({ success: true });
      }
      
      return NextResponse.json({ success: false, error: 'No matching records deleted' }, { status: 400 });
    }
    
    if (action === 'batch_dispo') {
      const { locationId, tags, agentId } = body;
      if (!locationId || !tags || !Array.isArray(tags) || tags.length === 0 || !agentId) {
        return NextResponse.json({ success: false, error: 'Location, Tags list, and Operator ID are mandatory' }, { status: 400 });
      }

      let dType: BaggageItem['dispo_type'] = 'Storage Location';
      let dValue = '';
      let finalLocId = locationId;
      let targetLocName = 'Unknown';

      if (locationId.startsWith('agent:')) {
        const agentIdVal = locationId.split(':')[1];
        const agent = db.delivery_agents.find(a => a.id === agentIdVal);
        if (!agent) {
          return NextResponse.json({ success: false, error: 'Target delivery agent not found' }, { status: 404 });
        }
        dType = 'Delivery Agent';
        dValue = agent.agent_name;
        targetLocName = agent.agent_name;
      } else if (locationId.startsWith('type:')) {
        const typeVal = locationId.split(':')[1] as any;
        dType = typeVal;
        dValue = typeVal;
        targetLocName = typeVal;
      } else {
        const targetLocation = db.locations.find(l => l.id === locationId);
        if (!targetLocation) {
          return NextResponse.json({ success: false, error: 'Target location not found' }, { status: 404 });
        }
        dType = 'Storage Location';
        dValue = targetLocation.location_name;
        targetLocName = targetLocation.location_name;
      }

      const results: { tag: string; status: string; message: string }[] = [];
      
      for (const tagRaw of tags) {
        const tagTrimmed = tagRaw.trim();
        if (!tagTrimmed) continue;

        const parsed = parseBagTag(tagTrimmed);
        if (!parsed) {
          results.push({ tag: tagTrimmed, status: 'Error', message: 'Invalid tag format' });
          continue;
        }

        let bag = db.baggage_items.find(b => b.universal_tag === parsed.universalTag && !b.is_deleted);
        
        if (!bag) {
          // Check manifests for identity
          let foundInManifestRow = null;
          for (const m of db.manifests) {
             const row = m.rows?.find(r => {
                const rOrig = r.original_tag ? parseBagTag(r.original_tag)?.universalTag : null;
                const rRush = r.rush_tag ? parseBagTag(r.rush_tag)?.universalTag : null;
                return rOrig === parsed.universalTag || rRush === parsed.universalTag;
             });
             if (row) {
                foundInManifestRow = row;
                break;
             }
          }

          if (foundInManifestRow) {
             // Auto-register from Manifest
             const newBagId = 'bag-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
             bag = {
               id: newBagId,
               universal_tag: parsed.universalTag,
               alpha_tag: parsed.alphaTag,
               current_location_id: finalLocId,
               airline_name: parsed.airlineName || 'Unknown',
               serial_number: parsed.serialNumber,
               status: 'Batch Dispo (Manifest)',
               dispo_type: dType,
               dispo_value: dValue,
               updated_at: new Date().toISOString(),
               pir: foundInManifestRow.pir,
               passenger_name: foundInManifestRow.passenger_name,
               original_tag: foundInManifestRow.original_tag,
               rush_tag: foundInManifestRow.rush_tag,
               flight_no: foundInManifestRow.flight_no,
               seal_no: foundInManifestRow.seal_no,
               destination: foundInManifestRow.destination,
               remarks: foundInManifestRow.remarks
             };
             db.baggage_items.push(bag);
             
             // Audit Log for new registration
             db.audit_logs.push({
                id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                bag_id: newBagId,
                universal_tag: parsed.universalTag,
                alpha_tag: parsed.alphaTag,
                previous_location_id: null,
                previous_location_name: null,
                new_location_id: finalLocId,
                new_location_name: targetLocName,
                reason: 'BATCH_REGISTRATION',
                agent_id: agentId,
                timestamp: new Date().toISOString()
             });
             
             results.push({ tag: tagTrimmed, status: 'Success', message: 'Registered from Manifest' });
          } else {
             results.push({ tag: tagTrimmed, status: 'Error', message: 'Identity not found in Registry or Manifest' });
             continue;
          }
        } else {
          // Update existing registry entry
          const prevLocId = bag.current_location_id;
          const oldLoc = db.locations.find(l => l.id === prevLocId);
          
          bag.current_location_id = finalLocId;
          bag.status = 'Batch Allocation';
          bag.dispo_type = dType;
          bag.dispo_value = dValue;
          bag.updated_at = new Date().toISOString();
          
          // Audit Log
          db.audit_logs.push({
            id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            bag_id: bag.id,
            universal_tag: parsed.universalTag,
            alpha_tag: parsed.alphaTag,
            previous_location_id: prevLocId,
            previous_location_name: oldLoc ? oldLoc.location_name : 'Unknown',
            new_location_id: finalLocId,
            new_location_name: targetLocName,
            reason: 'BATCH_DISPO',
            agent_id: agentId,
            timestamp: new Date().toISOString()
          });
          
          results.push({ tag: tagTrimmed, status: 'Success', message: 'Location Updated' });
        }
      }

      await writeDatabase(db);
      return NextResponse.json({ success: true, results });
    }

    if (action === 'update_allowed_flights') {
      const { flights } = body;
      if (!flights || !Array.isArray(flights)) {
        return NextResponse.json({ success: false, error: 'Flight list is required' }, { status: 400 });
      }
      db.allowed_flights = flights.map(f => f.trim()).filter(f => f.length > 0);
      await writeDatabase(db);
      return NextResponse.json({ success: true, flights: db.allowed_flights });
    }

    if (action === 'reset_database') {
      const DEFAULT_STATE_RESET: DatabaseState = {
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
            pir: 'PIR-LH-88201',
            passenger_name: 'Marcus Lehmann',
            original_tag: '0220123456',
            rush_tag: 'LH 900501',
            flight_no: 'LH 430',
            seal_no: 'S-712',
            destination: 'FRA',
            remarks: 'Expected early delivery priority'
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
            pir: 'PIR-UA-48821',
            passenger_name: 'Alice Johnson',
            original_tag: '0016456789',
            rush_tag: 'UA 112233',
            flight_no: 'UA 925',
            seal_no: 'S-103',
            destination: 'ORD',
            remarks: 'Fragile medical equipment'
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
            pir: 'PIR-DL-22921',
            passenger_name: 'Robert Davis',
            original_tag: '0006789012',
            rush_tag: 'DL 789013',
            flight_no: 'DL 190',
            seal_no: 'S-204',
            destination: 'ATL',
            remarks: 'Heavy sports inventory'
          }
        ],
        locations: [
          { id: 'loc-1', location_name: 'Warehouse A', location_type: 'Storage', qr_code_hash: 'hash-warehouse-a' },
          { id: 'loc-2', location_name: 'Arrival Hall B', location_type: 'Storage', qr_code_hash: 'hash-arrival-hall-b' },
          { id: 'loc-3', location_name: 'Terminal 1 Reclaim', location_type: 'Delivery', qr_code_hash: 'hash-t1-reclaim' },
          { id: 'loc-4', location_name: 'Terminal 2 Carousel', location_type: 'Delivery', qr_code_hash: 'hash-t2-carousel' },
          { id: 'loc-5', location_name: 'Customs Holding Area', location_type: 'Storage', qr_code_hash: 'hash-customs-hold' },
          { id: 'loc-6', location_name: 'Outbound Sorting Dock', location_type: 'Delivery', qr_code_hash: 'hash-sorting-dock' },
        ],
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
            airline_code: 'LH',
            rows: [
              {
                id: 'row-mnf1-1',
                pir: 'PIR-LH-88201',
                passenger_name: 'Marcus Lehmann',
                original_tag: '0220123456',
                rush_tag: 'LH 900501',
                flight_no: 'LH 430',
                seal_no: 'S-712',
                destination: 'FRA',
                remarks: 'Expected early delivery priority'
              },
              {
                id: 'row-mnf1-2',
                pir: 'PIR-LH-22910',
                passenger_name: 'Sophie Dubois',
                original_tag: '0220123457',
                rush_tag: 'LH 900502',
                flight_no: 'LH 430',
                seal_no: 'S-713',
                destination: 'CDG',
                remarks: 'Contains heavy winter clothing'
              },
              {
                id: 'row-mnf1-3',
                pir: 'PIR-LH-99302',
                passenger_name: 'Jonas Fischer',
                original_tag: '0220123458',
                rush_tag: 'LH 900503',
                flight_no: 'LH 430',
                seal_no: 'S-714',
                destination: 'MUC',
                remarks: 'Connection transfer flight FRA'
              },
              {
                id: 'row-mnf1-4',
                pir: 'PIR-LH-10394',
                passenger_name: 'Elena Rostova',
                original_tag: '0220888999',
                rush_tag: '',
                flight_no: 'LH 430',
                seal_no: 'S-715',
                destination: 'DME',
                remarks: 'Awaiting final flight confirm'
              }
            ]
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
      
      await writeDatabase(DEFAULT_STATE_RESET);
      return NextResponse.json({ success: true, data: DEFAULT_STATE_RESET });
    }
    
    return NextResponse.json({ success: false, error: 'Invalid backend action requested' }, { status: 400 });
  } catch (error) {
    console.error('API Post Request Crash:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown Server Error occurred' }, { status: 500 });
  }
}
