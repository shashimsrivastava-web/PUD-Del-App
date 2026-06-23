import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function POST(req: NextRequest) {
  try {
    const { baggageItems } = await req.json();
    
    // Calculate basic statistics from the client-side, 
    // but pass enough context for Gemini to format the requested report.
    // Given 4000 items is ~220KB, this is fine to send in the prompt.
    
    const prompt = `Based on the following list of baggage items, compile a summary in the exact format provided below.
    Items: ${JSON.stringify(baggageItems)}
    
    Format:
    Of the bags expected Today:
    Total bags expected: [Count total]
    Total bags arrived: [Count status='Arrived']
    Total that did not arrive despite forwarding: [Count dispo_type='DID NOT ARRIVE']
    Bags handed over to Delivery agents: [Count dispo_type='Delivery Agent']
    Bags handed over to OAL: [Count dispo_type='Handover to OAL']
    Bags for DOM forwarding: [Count dispo_type='Domestic forward']
    Bags in Arrival Belt 9: [Count current_location_id='Arrival Belt 9']
    Bags in CWC warehouse: [Count current_location_id='CWC warehouse']
    Bags in LHG Office: [Count current_location_id='LHG Office']
    Bags in BMA: [Count current_location_id='BMA']
    Bags in Level 4: [Count current_location_id='Level 4']
    Bags not cleared by customs or marked preventive: [Count status='Preventive' or similar indicators]
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    
    return NextResponse.json({ summary: response.text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
