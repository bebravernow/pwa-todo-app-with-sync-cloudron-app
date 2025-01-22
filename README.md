# Minimalist Todo App

A modern, minimalist todo application with device synchronization and calendar integration capabilities, packaged for Cloudron.io.

## Features

- ✨ Clean, minimalist interface
- 🌓 Dark/Light mode with system preference detection
- 📱 Device synchronization using secure P2P connections
- 📅 Calendar integration with subscribable ICS feed
- 🔄 Offline support with IndexedDB
- 📲 Progressive Web App (PWA) ready
- ☁️ Easy installation on Cloudron.io

## Installation

### Cloudron Installation

1. Open your Cloudron dashboard
2. Go to App Store
3. Click on "Install from App Store"
4. Search for "Todo App" or use direct URL
5. Click Install

The app will be automatically installed and configured on your Cloudron instance.

### Manual Installation on Cloudron

If you want to install the app manually:

1. Clone this repository:
```bash
git clone https://github.com/bebravernow/pwa-todo-app-with-sync-cloudron-app.git
cd pwa-todo-app-with-sync-cloudron-app
```

2. Install the app on your Cloudron:
```bash
cloudron install
```

## Data Storage

Todo data is stored in the Cloudron-managed data directory at `/app/data/todos-db`. This ensures:
- Data persistence across app updates
- Automatic backups through Cloudron
- Proper data isolation

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Security Features

- All sync data is end-to-end encrypted
- Sync codes are never stored on servers
- P2P connections are encrypted
- Calendar feed requires valid sync code
- Data is stored locally in LevelDB
- Runs as non-root user in container

## Cloudron-specific Configuration

The app is configured to work seamlessly with Cloudron:
- Uses Cloudron's data directory for persistence
- Implements health check endpoint
- Proper process management
- Secure by default configuration

## License

MIT