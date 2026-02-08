# GitHunter Development Plan

## Tech Stack Overview

**Frontend:**
- React (Vite for faster dev experience)
- TailwindCSS for styling
- React Router for navigation
- Axios for API calls
- jsPDF or react-pdf for PDF generation
- Chart.js or Recharts for visualizations

**Backend:**
- Node.js + Express
- Octokit (@octokit/rest) for GitHub API integration
- OpenAI API or Anthropic Claude API for AI analysis
- Bull/BullMQ for job queuing (analysis can take time)
- Redis (for queue + caching GitHub data)
- Rate limiting middleware (express-rate-limit)

**Infrastructure:**
- PostgreSQL (optional: store analysis history)
- Environment variables for API keys

***

## Logical Flow

### Phase 1: Recruiter View

1. **User Input** → Recruiter enters GitHub username
2. **Data Collection** → Backend fetches via GitHub API:
   - User profile metadata
   - All public repositories
   - Commit history, languages used, repo stats
   - README files, code samples from key files
3. **AI Analysis Pipeline** → Backend sends structured data to AI:
   - Repo quality assessment (documentation, structure, complexity)
   - Code quality review (pull random files, analyze patterns)
   - Technology stack breadth/depth
   - Contribution consistency and recency
   - Project diversity and complexity
4. **Score Generation** → AI produces:
   - Overall score (0-100)
   - Category scores (code quality, documentation, consistency, etc.)
   - Strengths (3-5 bullet points)
   - Weaknesses (3-5 bullet points)
   - Hiring recommendation (Strong Hire, Hire, Maybe, Pass)
5. **PDF Report** → Generate downloadable PDF with all insights
6. **Display Results** → Show on web interface with charts/visualizations

### Phase 2: Developer Self-Evaluation View

- Same flow as Phase 1, but with additional sections:
  - "Growth Recommendations" (specific, actionable)
  - "Suggested Projects" to fill gaps
  - Comparison to role-specific benchmarks
  - Timeline showing progress (if re-evaluated later)

***

## Technical Architecture

### Frontend Structure
```
src/
├── components/
│   ├── InputForm.jsx (username input)
│   ├── LoadingState.jsx (analysis in progress)
│   ├── ReportView.jsx (display results)
│   ├── ScoreCard.jsx (visual score display)
│   └── PDFDownload.jsx (generate/download PDF)
├── pages/
│   ├── RecruiterView.jsx
│   └── DeveloperView.jsx
├── services/
│   └── api.js (axios instance)
└── utils/
    └── pdfGenerator.js
```

### Backend Structure
```
server/
├── routes/
│   ├── analyze.js (POST /api/analyze)
│   └── report.js (GET /api/report/:id)
├── services/
│   ├── githubService.js (Octokit wrapper)
│   ├── aiService.js (OpenAI/Claude integration)
│   └── analysisService.js (orchestrates analysis)
├── workers/
│   └── analysisWorker.js (Bull queue processor)
└── utils/
    └── codeParser.js (extract meaningful code snippets)
```

***

## Key Implementation Details

### 1. GitHub Data Collection
```javascript
// Fetch critical data points
- User profile (followers, repos, bio)
- Repos (stars, forks, languages, last_updated)
- Top 10-15 most significant repos (by stars/recent activity)
- Sample files: README, main source files
- Commit frequency over last 6-12 months
```

### 2. AI Prompt Engineering
Send structured JSON to AI with:
- Repo summaries with README content
- Code snippets (5-10 files max to stay under token limits)
- Metadata (languages, frameworks detected)
- Ask AI to evaluate using rubric:
  - Code Quality (30%)
  - Project Complexity (20%)
  - Documentation (15%)
  - Consistency/Activity (15%)
  - Technical Breadth (20%)

### 3. Job Queue (Critical for UX)
- Analysis takes 30-60 seconds
- Use Bull queue to process async
- Return job ID immediately to frontend
- Frontend polls `/api/status/:jobId` every 2 seconds
- When complete, redirect to results

### 4. PDF Generation
Use jsPDF to programmatically create:
- Header with candidate name + GitHub avatar
- Executive summary
- Score breakdown with visual bars
- Detailed sections for each category
- Recommendation at bottom

***

## API Endpoints

```
POST /api/analyze
Body: { username: "somedev", view: "recruiter" | "developer" }
Response: { jobId: "uuid" }

GET /api/status/:jobId
Response: { status: "processing" | "complete", progress: 45 }

GET /api/report/:jobId
Response: { ...full analysis data }

GET /api/download/:jobId
Response: PDF file stream
```

***

## Environment Variables Needed
```
GITHUB_TOKEN=<personal_access_token>
OPENAI_API_KEY=<key>
REDIS_URL=<redis_connection>
PORT=5000
```

***

## Development Timeline (Hackathon Sprint)

**Hour 0-2:** Setup
- Initialize React + Vite frontend
- Setup Express backend with basic routes
- Connect Redis and test GitHub API

**Hour 2-6:** Core Functionality
- Build GitHub data fetching service
- Implement AI analysis logic
- Setup job queue system

**Hour 6-10:** Frontend Build
- Create input form and loading states
- Build report visualization components
- Implement PDF generation

**Hour 10-12:** Polish
- Add error handling
- Style with Tailwind
- Test end-to-end with real profiles

**Hour 12+:** Phase 2 (if time)
- Add developer view with growth recommendations
- Refine AI prompts for actionable feedback

***

## Quick Wins / Tips

1. **Cache GitHub data** (Redis, 5 min TTL) to avoid rate limits
2. **Limit analysis scope** to top 10 repos to stay fast
3. **Use GPT-4 mini** or Claude Haiku for cost efficiency
4. **Hardcode a rubric** in your AI prompt for consistency
5. **Test with diverse profiles** (frontend dev, ML engineer, etc.)
6. **Make PDF look professional** - recruiters judge quality

***

You've got a solid, buildable project here. Focus on Phase 1 first, make the analysis accurate and fast, and the PDF output polished. That alone will impress judges. Phase 2 is just a UI switch with prompt tweaks. Let me know when you want to dive into specific implementation details!