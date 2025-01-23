import Peer from 'peerjs';
import { openDB } from 'idb';

// Types
export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  createdAt: number;
  updatedAt: number;
}

interface SyncData {
  todos: Todo[];
  lastSync: number;
}

// Generate ICS file content
export const generateICS = (todos: Todo[]): string => {
  const events = todos
    .filter(todo => todo.dueDate)
    .map(todo => {
      const dueDate = new Date(todo.dueDate!);
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

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Todos App//EN
CALSCALE:GREGORIAN
${events}
END:VCALENDAR`;
};

// Generate a unique peer ID
const generatePeerId = (syncCode: string, attempt = 0): string => {
  const timestamp = Date.now().toString(36);
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const random = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `todo-${timestamp}-${random}${attempt > 0 ? `-${attempt}` : ''}`;
};

// Generate a random sync code
export const generateSyncCode = (): string => {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Initialize IndexedDB
export const initDB = async () => {
  return openDB('todos-db', 1, {
    upgrade(db) {
      db.createObjectStore('todos', { keyPath: 'id' });
      db.createObjectStore('sync', { keyPath: 'id' });
    },
  });
};

// Encrypt data using the sync code as key
const encryptData = async (data: any, syncCode: string): Promise<string> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(syncCode),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('todo-sync-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoder.encode(JSON.stringify(data))
  );

  return JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  });
};

// Decrypt data using the sync code
const decryptData = async (encryptedData: string, syncCode: string): Promise<any> => {
  const { iv, data } = JSON.parse(encryptedData);
  const encoder = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(syncCode),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('todo-sync-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
    },
    key,
    new Uint8Array(data)
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
};

// Initialize P2P connection with retry logic
export const initSync = (syncCode: string, onSync: (data: SyncData) => void) => {
  let retryCount = 0;
  const maxRetries = 3;
  let peer: Peer | null = null;
  let currentPeerId: string | null = null;

  const initPeer = async (attempt = 0) => {
    if (peer) {
      peer.destroy();
    }

    // Generate a new unique peer ID for each attempt
    currentPeerId = generatePeerId(syncCode, attempt);

    peer = new Peer(currentPeerId, {
      debug: 2, // Reduced debug level
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (attempt < maxRetries) {
          console.log(`Connection attempt ${attempt + 1} timed out, retrying...`);
          initPeer(attempt + 1).then(resolve).catch(reject);
        } else {
          reject(new Error('Max retries reached'));
        }
        peer?.destroy();
      }, 5000);

      peer.on('open', (id) => {
        clearTimeout(timeout);
        console.log('Connected with ID:', id);
        resolve();
      });

      peer.on('error', (error) => {
        clearTimeout(timeout);
        console.error('PeerJS error:', error);
        if (error.type === 'unavailable-id' && attempt < maxRetries) {
          console.log(`Retrying with new ID (attempt ${attempt + 1}/${maxRetries})...`);
          initPeer(attempt + 1).then(resolve).catch(reject);
        } else {
          reject(error);
        }
      });

      peer.on('connection', (conn) => {
        console.log('Incoming connection from:', conn.peer);
        
        conn.on('open', () => {
          console.log('Connection opened with:', conn.peer);
        });

        conn.on('data', async (encryptedData: string) => {
          try {
            console.log('Received data from:', conn.peer);
            const data = await decryptData(encryptedData, syncCode);
            onSync(data);
          } catch (error) {
            console.error('Failed to decrypt sync data:', error);
          }
        });

        conn.on('error', (error) => {
          console.error('Connection error:', error);
        });
      });
    });
  };

  initPeer().catch(error => {
    console.error('Failed to initialize peer:', error);
  });

  return {
    peer: peer!,
    getId: () => currentPeerId
  };
};

// Connect to another device
export const connectToDevice = async (
  peerWrapper: { peer: Peer; getId: () => string | null },
  targetId: string,
  syncCode: string,
  data: SyncData
) => {
  console.log('Connecting to device:', targetId);
  const conn = peerWrapper.peer.connect(targetId, {
    reliable: true,
    serialization: 'json',
    metadata: { 
      type: 'todo-sync',
      sourceId: peerWrapper.getId()
    }
  });
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
      conn.close();
    }, 10000);

    conn.on('open', async () => {
      clearTimeout(timeout);
      console.log('Connection established with:', targetId);
      try {
        const encryptedData = await encryptData(data, syncCode);
        conn.send(encryptedData);
        console.log('Data sent to:', targetId);
        resolve(conn);
      } catch (error) {
        console.error('Failed to send data:', error);
        reject(error);
      }
    });

    conn.on('error', (error) => {
      clearTimeout(timeout);
      console.error('Connection error:', error);
      reject(error);
    });
  });
};