# GlassFit

A glass and window product visualization platform. Upload a photo of your space, overlay realistic 3D glass product models onto it, and generate a price quotation and booking request — all in the browser.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| 3D Rendering | React Three Fiber, Three.js |
| Animation | Motion (Framer Motion) |
| Backend CV | FastAPI (Python), YOLOv8, Depth Anything V2, SegFormer |
| Database / Auth | Supabase (Postgres + Auth) |
| Object Storage | Cloudflare R2 |

---

## Prerequisites

- **Node.js** v20+ and **npm**
- **Python** 3.10+
- A **Supabase** project (for database and auth)
- A **Cloudflare R2** bucket (for image storage)

---

## Environment Variables

Create a `.env.local` file in the project root with the following keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_R2_ASSET_BASE_URL=
NEXT_PUBLIC_IMAGE_API_URL=
```

---

## Running the Frontend

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running the Backend (FastAPI Image Service)

The FastAPI service handles AI-powered image analysis (object segmentation, depth estimation, scene detection, and lighting analysis).

```bash
cd fastapi-service

# Create and activate a virtual environment
python -m venv .venv
source venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate          # Windows

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

The service will be available at [http://localhost:8000](http://localhost:8000).  
Health check: [http://localhost:8000/health](http://localhost:8000/health).

> **Note:** On first startup, the service downloads and caches YOLOv8, Depth Anything V2, and SegFormer model weights. This may take a few minutes depending on your connection.

---

## Project Structure

```
glassfit/
├── src/
│   ├── app/              # Next.js App Router pages & routes
│   ├── features/         # Feature-sliced modules (home, product, visualization, booking, etc.)
│   ├── components/       # Shared UI components & shadcn/ui primitives
│   └── lib/              # Supabase clients, image API client, 3D engine utilities
├── fastapi-service/      # Python CV backend (segmentation, depth, scene detection)
├── supabase/
│   └── migrations/       # SQL database migrations
└── public/               # Static assets and fonts
```

---
