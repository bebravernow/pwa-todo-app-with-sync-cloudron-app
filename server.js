import express from 'express';
import path from 'path';
import { Level } from 'level';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Initialize LevelDB in the Cloudron data directory
const db = new Level('/app/data/todos-db', { valueEncoding: 'json' });

app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// Health check endpoint for Cloudron
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// API endpoints
app.get('/api/calendar.ics', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    res.status(400).json({ error: 'Sync code is required' });
    return;
  }

  try {
    const todos = [];
    for await (const [key, value] of db.iterator()) {
      if (key.startsWith(`todos:${code}:`)) {
        todos.push(value);
      }
    }

    const events = todos
      .filter(todo => todo.dueDate)
      .map(todo => {
        const dueDate = new Date(todo.dueDate);
        const uid = `${todo.id}@todos-app`;
        return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${new Date(todo.createdAt).toISOString().replace(/[-:.]/g, '').slice(0, -4)}Z
DTSTART;VALUE=DATE:${dueDate.toISOString().slice(0, 10).replace(/-/g, '')}
SUMMARY:${todo.text}${todo.completed ? ' (Completed)' : ''}
STATUS:${todo.completed ? 'COMPLETED' : 'NEEDS-ACTION'}
END:VEVENT`;
      })
      .join('\n');

    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Todos App//EN
CALSCALE:GREGORIAN
X-WR-CALNAME:My Todos
REFRESH-INTERVAL;VALUE=DURATION:PT1H
X-PUBLISHED-TTL:PT1H
${events}
END:VCALENDAR`;

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(calendar);
  } catch (error) {
    console.error('Calendar generation error:', error);
    res.status(500).json({ error: 'Failed to generate calendar feed' });
  }
});

// API endpoint for storing todos
app.post('/api/todos', async (req, res) => {
  const { syncCode, todo } = req.body;
  
  if (!syncCode || !todo) {
    res.status(400).json({ error: 'Sync code and todo are required' });
    return;
  }

  try {
    await db.put(`todos:${syncCode}:${todo.id}`, todo);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Store todo error:', error);
    res.status(500).json({ error: 'Failed to store todo' });
  }
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});