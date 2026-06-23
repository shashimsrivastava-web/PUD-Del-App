import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { baggageItems, locations } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are an intelligent baggage system assistant.
Compile a summary of the provided baggage and locations data exactly in this format:

Of the bags expected Today: [date or brief summary]
Total bags expected: [count]
Total bags arrived: [count]
Total that did not arrive despite forwarding: [count]
Bags handed over to Delivery agents: [count]
Bags handed over to OAL: [count]
Bags for DOM forwarding: [count]
Bags in Arrival Belt 9: [count]
Bags in CWC warehouse: [count]
Bags in LHG Office: [count]
Bags in BMA: [count]
Bags in Level 4: [count]
Bags not cleared by customs or marked preventive: [count]

Analyze the following JSON datasets to precisely calculate these statistics.
Baggage Data: ${JSON.stringify(baggageItems)}
Locations Data: ${JSON.stringify(locations)}

A bag's 'dispo_type' and 'dispo_value' (which relates to location names), along with its 'status', should be used to deduce the counts for each category. For location specific counts (Belt 9, CWC warehouse, LHG Office, BMA, Level 4), sum the bags currently assigned to or located in those locations based on their names. Let 'expected' be the total number of items, and 'arrived' be items that are not marked 'DID NOT ARRIVE'. Be accurate. Only output the exact textual format requested holding the calculated counts.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error("Summary API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
