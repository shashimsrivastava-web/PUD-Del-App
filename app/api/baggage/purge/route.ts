import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid IDs for purge" }, { status: 400 });
    }

    const batch = writeBatch(db);
    
    // We purge by ID list
    for (const id of ids) {
      const docRef = doc(db, "baggage_items", id);
      batch.delete(docRef);
      
      // Also add an audit log
      const logRef = doc(collection(db, "audit_logs"));
      batch.set(logRef, {
        timestamp: new Date().toISOString(),
        action: "purge_record_hard",
        details: `Hard purge of record ID: ${id}`,
        user: "Admin (Purge Tool)",
        color: "rose"
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error: any) {
    console.error("Purge Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
