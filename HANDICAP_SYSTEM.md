# GPF Handicap System Documentation

## Overview

Golf P'la Fresquinha uses a simplified version of the **R&A World Handicap System (WHS)** to calculate player handicaps based on their submitted rounds.

## Registration

When a member registers, they provide:
- **Full Name**: Their name
- **Email**: GPF email account
- **Password**: For secure login
- **Handicap Index**: Their current WHS handicap index (e.g., 12.5)

The initial handicap is stored as `manualHandicap` and serves as their baseline.

## Handicap Calculation

### Initial Handicap
When a player first registers or has no submitted rounds, their handicap is their registered `manualHandicap` value.

### Updated Handicap (Best 3 Score Differentials)
Once a player submits approved qualifying rounds, their handicap is recalculated using the **best 3 Score Differentials** from all their qualifying rounds.

### WHS Score Differential Formula

```
Score Differential = (113 / Slope Rating) × (Gross Score - Course Rating)
```

Where:
- **113** = Standard slope rating (neutral difficulty)
- **Slope Rating** = Measure of course difficulty for bogey golfers vs scratch golfers (range: 55–155)
- **Course Rating** = Expected score for a scratch golfer on that course from the tees played
- **Gross Score** = Player's actual total score for the round

### Example Calculation

**Player:** Lourenco
- **Initial Handicap:** 8.5
- **Submitted 3 qualifying rounds:**

| Round | Course | Tee | Gross | Course Rating | Slope | Score Diff |
|-------|--------|-----|-------|----------------|-------|-----------|
| 1 | Lisbon Sports Club | White | 77 | 70.5 | 126 | (113/126) × (77-70.5) = 5.8 |
| 2 | Lisbon Sports Club | White | 80 | 70.5 | 126 | (113/126) × (80-70.5) = 8.5 |
| 3 | Lisbon Sports Club | White | 75 | 70.5 | 126 | (113/126) × (75-70.5) = 4.0 |

**Updated Handicap:** Average of best 3 = (5.8 + 8.5 + 4.0) / 3 = **6.1**

## Course Tee Ratings

### Lisbon Sports Club (Home Course)

| Tee | Par | Course Rating | Slope |
|-----|-----|---------------|-------|
| Yellow | 69 | 69.0 | 123 |
| White | 69 | 70.5 | 126 |
| Red | 71 | 71.2 | 128 |

### Auto-Created Courses

When a course is auto-created (e.g., from OCR extraction or manual entry), default values are assigned:
- **Course Rating** = Course Par (conservative estimate)
- **Slope Rating** = 113 (neutral standard)

Example: A course created as "Par 72" will have:
- **Course Rating:** 72.0
- **Slope:** 113

## API Endpoints

### Registration
**POST** `/api/register`

Request:
```json
{
  "name": "Lourenco",
  "email": "lourenco@gpf.golf",
  "password": "welcome123",
  "handicap": "8.5"
}
```

### Get Handicap (Leaderboard)
**GET** `/api/leaderboard`

Returns current handicap for each player, including:
- `hcp`: Current calculated handicap (based on best 3 scores or manual override)
- `qualified`: Whether the player has submitted enough qualifying rounds

## Data Model

### User
```
- id: Unique identifier
- name: Player's full name
- email: GPF email
- manualHandicap: Initial/baseline handicap (Float, nullable)
- role: MEMBER or ADMIN
```

### Tee
```
- id: Unique identifier
- name: Tee name (e.g., "White")
- par: Par for the tee
- rating: Course rating (e.g., 70.5)
- slope: Slope rating (e.g., 126)
- courseId: Reference to the course
```

### Round
```
- userId: Player who shot the round
- competitionId: Active competition
- gross: Gross score
- courseId: Course played
- teeId: Tee played (links to rating/slope)
- status: APPROVED (only approved rounds count)
```

## Key Differences from Full WHS

The GPF system simplifies the R&A World Handicap System:

| Feature | Full WHS | GPF |
|---------|----------|-----|
| Scoring Records | 20 best of last rounds | Best 3 qualifying rounds |
| Calculation | Average of best 8 | Average of best 3 |
| Score Differential | Same formula | Same formula |
| Soft/Hard Caps | Applied | Not applied |
| Exceptional Scores | Tracked | Not tracked |
| Scope | Worldwide portable | GPF competition only |

## Integration with Leaderboards

### Qualifying Rounds (Road Board)
- **Handicap Used:** Current calculated handicap
- **Shown On:** "Road to GPF" leaderboard
- **Updates:** After each approved qualifying round

### Weekend Rounds (Final Board)
- **Handicap Used:** Calculated handicap from all prior qualifying rounds
- **Shown On:** "GPF Weekend" leaderboard
- **Playing Handicap:** `(Handicap × 90%) / 100` (90% allowance for Medal Net)
- **Net Score:** `Gross - Playing Handicap`

## Testing

Sample registered members (when `SEED_SAMPLE=true`):

| Name | Email | Password | Initial Handicap |
|------|-------|----------|------------------|
| Lourenco | lourenco@gpf.golf | welcome123 | 8.5 |
| Diogo | diogo@gpf.golf | welcome123 | 12.3 |
| Tiago | tiago@gpf.golf | welcome123 | 6.2 |
| Bruno | bruno@gpf.golf | welcome123 | 14.1 |
| Andre | andre@gpf.golf | welcome123 | 18.7 |
| Rafa | rafa@gpf.golf | welcome123 | 10.4 |

## References

- R&A Rules of Handicapping: https://www.randa.org/en/roh/the-rules-of-handicapping
- World Handicap System Overview: https://www.randa.org/en/world-handicap-system
- Course Rating & Slope: https://www.randa.org/en/world-handicap-system/fundamentals

## Code Files

- **Frontend:** `src/app/login/page.jsx` (registration form)
- **API:** `src/app/api/register/route.js` (handicap storage)
- **Scoring:** `src/lib/scoring.js` (WHS Score Differential calculation)
- **Data:** `src/lib/data.js` (getScopedRounds fetches tee data)
- **Courses:** `src/app/api/courses/route.js` (default tee ratings)
- **Seeding:** `prisma/seed.mjs` (sample members with handicaps)
