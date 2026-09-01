import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Serve JSON payloads parsed
  app.use(express.json());

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Smart Handover report builder endpoint
  app.post("/api/gemini/handover-summary", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ 
        error: "GEMINI_API_KEY is not defined. Please configure Gemini API Key in the Settings secrets panel." 
      });
    }

    try {
      const {
        outgoing_shift_name,
        incoming_shift_name,
        incidents = [],
        tasks = [],
        clock_logs = [],
        gate_activity = {},
        additional_notes = "",
        language = "en"
      } = req.body;

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Format contextual data into plain labels for AI
      const incidentsText = incidents.length > 0 
        ? incidents.map((inc: any) => `- Severity: ${inc.severity || 'LOW'}, Category: ${inc.type || 'Other'}, Description: ${inc.description}, Location: ${inc.location || 'N/A'}, Status: ${inc.status || 'open'}`).join("\n")
        : "No incidents reported during this shift.";

      const tasksText = tasks.length > 0
        ? tasks.map((t: any) => `- Priority: ${t.priority || 'LOW'}, Title: ${t.title}, Description: ${t.description || 'N/A'}, Status: ${t.status || 'pending'}, Assigned To: ${t.assigned_to_name || t.assigned_to || 'Unassigned'}`).join("\n")
        : "No tasks managed during this shift.";

      const clockLogsText = clock_logs.length > 0
        ? clock_logs.map((log: any) => `- Staff: ${log.user_name}, clocked ${log.type} at ${log.timestamp}. coordinates: ${log.latitude}, ${log.longitude}`).join("\n")
        : "No staff movement check-ins reported.";

      const gateText = `Site Total Entries: ${gate_activity.entries || 0}, Site Total Exits: ${gate_activity.exits || 0}. Inner Monument entries: ${gate_activity.inner_entries || 0}. Hour peak distribution details: ${gate_activity.peak_info || "Normal visitor distribution"}`;

      const systemInstruction = `You are a professional site operations and security manager assistant.
Your goal is to synthesize raw site telemetry of the outgoing shift, and produce a flawless operational Shift Handover report.
Produce your output ONLY as a valid JSON object matching the schema. Do not enclose it in generic codeblocks, do not add any surrounding texts or conversational elements.
The language of all text fields, titles, and generated checklists MUST be exactly ${language === "ar" ? "Arabic" : "English"}.
Keep summaries dense, highly professional, actionable, and objective. Align instructions with recent safety hazards (e.g. issues, incidents) if present.`;

      const prompt = `Synthesize shift handover details from raw telemetry of the outgoing shift:
Outgoing Shift: ${outgoing_shift_name || "Night Shift"}
Incoming Shift: ${incoming_shift_name || "Day Shift"}

1. Core Recent Incidents Context:
${incidentsText}

2. Operations & Patrol Tasks Context:
${tasksText}

3. Staff Logins and Geofence Boundaries Context:
${clockLogsText}

4. Gate Access Site Capacity Context:
${gateText}

5. Supervisor's Additional Notes Context:
${additional_notes || "No extra notes written."}

Draft a smart, high-resolution Handover summary matching the schema.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: "Core executive summary of outgoing shift." },
              incidents_summary: { type: Type.STRING, description: "A detailed summary of incident responses and remaining hazards." },
              tasks_summary: { type: Type.STRING, description: "Review of patrol and facility tasks completed or status updates." },
              geofence_summary: { type: Type.STRING, description: "Staff attendance and geofence perimeter compliance status." },
              gate_activity_summary: { type: Type.STRING, description: "Visitor gate footfall and site load observations." },
              special_instructions: { type: Type.STRING, description: "Direct shift-handoff orders and priorities for incoming staff." },
              safety_focus: { type: Type.STRING, description: "A daily safety alert or risk-awareness point for incoming shift." },
              suggested_checklist: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "4 to 6 specific, actionable checklist lines for incoming staff."
              }
            },
            required: [
              "summary", "incidents_summary", "tasks_summary", "geofence_summary", 
              "gate_activity_summary", "special_instructions", "safety_focus", "suggested_checklist"
            ]
          }
        },
      });

      const responseText = response.text || "{}";
      const cleaned = responseText.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      res.json(JSON.parse(cleaned));
    } catch (error: any) {
      console.error("Gemini handover synthesis error:", error);
      res.status(500).json({ error: error.message || "Failed to generate handover report." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
