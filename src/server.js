#!/usr/bin/env node

import express from 'express';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { loadConfig, validateConfig, sanitizeForLogging } from './config.js';
import { parseEpicsFile, parseSprintStatus, buildExecutionPlan } from './parser.js';
import { Orchestrator } from './orchestrator.js';
import { initDb } from './db/index.js';
import { authRoutes, deleteExpiredSessions } from './auth/index.js';
import { verifyToken } from './auth/jwt.js';
import projectsRouter from './api/projects.js';
import agentsRouter from './api/agents.js';
import { setAuthenticatedClients, broadcast } from './services/websocket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// WebSocket close codes for authentication errors
const WS_CLOSE_AUTH_REQUIRED = 4001;
const WS_CLOSE_INVALID_TOKEN = 4002;

/**
 * BMAD Orchestrator Dashboard Server
 *
 * Provides:
 * - Web dashboard for monitoring progress
 * - WebSocket for real-time updates
 * - REST API for control (start, stop, status)
 */

class DashboardServer {
  constructor(projectRoot, options = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.port = options.port || 3456;
    this.authUser = options.user || process.env.DASH_USER || 'admin';
    this.authPass = options.pass || process.env.DASH_PASS || 'bmad2024';
    this.config = null;
    this.orchestrator = null;
    this.isRunning = false;
    this.isPaused = false;
    this.logs = [];
    this.maxLogs = 2000;
    this.clients = new Set();

    // Authenticated WebSocket clients (userId -> ws)
    this.authenticatedClients = new Map();

    // State
    this.state = {
      status: 'idle', // idle, running, paused, completed, failed, stopped
      projectRoot: this.projectRoot,
      currentBatch: null,
      epics: [],
      stories: [],
      progress: {
        totalEpics: 0,
        completedEpics: 0,
        totalStories: 0,
        completedStories: 0,
        failedStories: 0,
        inProgressStories: 0,
      },
      startTime: null,
      endTime: null,
      duration: null,
    };

    this.loadProjectConfig();
    this.initDatabase();
    this.setupServer();
  }

  loadProjectConfig() {
    try {
      this.config = loadConfig(this.projectRoot);
      const errors = validateConfig(this.config);
      if (errors.length > 0) {
        console.warn('Config warnings:', errors);
      }
    } catch (error) {
      console.error('Failed to load config:', error.message);
      this.config = { projectRoot: this.projectRoot };
    }
  }

  initDatabase() {
    try {
      initDb();
      // Start session cleanup on startup and every hour
      this.startSessionCleanup();
    } catch (error) {
      console.error('Failed to initialize database:', error.message);
      throw error;
    }
  }

  startSessionCleanup() {
    // Run immediately on startup
    const count = deleteExpiredSessions();
    if (count > 0) {
      console.log(`Cleaned up ${count} expired sessions`);
    }
    // Run every hour
    this.sessionCleanupInterval = setInterval(() => {
      const cleaned = deleteExpiredSessions();
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired sessions`);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  setupServer() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    // Trust reverse proxy (nginx/caddy) for correct protocol detection
    this.app.set('trust proxy', 1);

    // Middleware
    this.app.use(express.json());
    this.app.use(cookieParser());
    this.app.use(express.static(path.join(__dirname, '../public/dashboard')));

    // Auth routes (mounted at /auth)
    this.app.use('/auth', authRoutes);

    // API routes
    this.app.use('/api/projects', projectsRouter);
    this.app.use('/api/agents', agentsRouter);

    // Initialize authenticated clients for broadcast service
    setAuthenticatedClients(this.authenticatedClients);

    // WebSocket handling with JWT authentication
    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;

      // Extract token from query string
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        // No token provided - close with auth error
        ws.close(WS_CLOSE_AUTH_REQUIRED, 'Authentication required');
        this.addLog(`WebSocket auth failed: No token (${clientIp})`);
        return;
      }

      try {
        // Verify JWT token
        const user = verifyToken(token);

        // Check token type - only access tokens allowed
        if (user.type !== 'access') {
          ws.close(WS_CLOSE_INVALID_TOKEN, 'Invalid token type');
          this.addLog(`WebSocket auth failed: Invalid token type (${clientIp})`);
          return;
        }

        // Mark connection as authenticated
        ws.userId = user.userId;
        ws.username = user.username;
        ws.isAuthenticated = true;

        // Track both in legacy clients set and authenticated map
        this.clients.add(ws);
        this.authenticatedClients.set(user.userId, ws);

        this.addLog(`Client connected: ${user.username} (${clientIp})`);

        // Send connection acknowledgment
        ws.send(JSON.stringify({
          type: 'connection:established',
          data: { userId: user.userId, username: user.username },
          timestamp: new Date().toISOString(),
        }));

        // Send current state on connect
        ws.send(JSON.stringify({ type: 'state', data: this.state }));
        ws.send(JSON.stringify({ type: 'logs', data: this.logs.slice(-200) }));
        ws.send(JSON.stringify({ type: 'config', data: sanitizeForLogging(this.config) }));

        ws.on('message', (message) => {
          try {
            const msg = JSON.parse(message);
            this.handleWsMessage(ws, msg);
          } catch (e) {
            // Ignore invalid messages
          }
        });

        ws.on('close', () => {
          this.clients.delete(ws);
          if (ws.userId) {
            this.authenticatedClients.delete(ws.userId);
          }
        });
      } catch (error) {
        // Token verification failed
        ws.close(WS_CLOSE_INVALID_TOKEN, 'Invalid token');
        this.addLog(`WebSocket auth failed: Invalid token (${clientIp})`);
      }
    });

    // REST API routes
    this.setupRoutes();
  }

  handleWsMessage(ws, msg) {
    switch (msg.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      case 'getState':
        ws.send(JSON.stringify({ type: 'state', data: this.state }));
        break;
      case 'getLogs':
        ws.send(JSON.stringify({ type: 'logs', data: this.logs.slice(-(msg.limit || 200)) }));
        break;
    }
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', uptime: process.uptime() });
    });

    // Get current state
    this.app.get('/api/status', (req, res) => {
      res.json(this.state);
    });

    // Get execution plan
    this.app.get('/api/plan', (req, res) => {
      try {
        const epics = parseEpicsFile(this.config.epicsPath);
        const status = parseSprintStatus(this.config.sprintStatusPath);
        const plan = buildExecutionPlan(epics, status);
        res.json(plan);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get logs
    this.app.get('/api/logs', (req, res) => {
      const limit = parseInt(req.query.limit) || 200;
      const offset = parseInt(req.query.offset) || 0;
      res.json({
        logs: this.logs.slice(offset, offset + limit),
        total: this.logs.length,
      });
    });

    // Start orchestration
    this.app.post('/api/start', async (req, res) => {
      if (this.isRunning) {
        return res.status(400).json({ error: 'Already running' });
      }

      const options = req.body || {};
      this.addLog(`Start requested with options: ${JSON.stringify(options)}`);
      res.json({ message: 'Starting orchestration...', status: 'starting' });

      // Run in background
      setImmediate(() => this.startOrchestration(options));
    });

    // Stop orchestration
    this.app.post('/api/stop', (req, res) => {
      if (!this.isRunning) {
        return res.status(400).json({ error: 'Not running' });
      }

      this.isRunning = false;
      this.state.status = 'stopped';
      this.state.endTime = new Date().toISOString();
      this.broadcast({ type: 'state', data: this.state });
      this.addLog('Orchestration stopped by user');

      res.json({ message: 'Stopped', status: 'stopped' });
    });

    // Pause/Resume
    this.app.post('/api/pause', (req, res) => {
      if (!this.isRunning) {
        return res.status(400).json({ error: 'Not running' });
      }

      this.isPaused = !this.isPaused;
      this.state.status = this.isPaused ? 'paused' : 'running';
      this.broadcast({ type: 'state', data: this.state });
      this.addLog(this.isPaused ? 'Orchestration paused' : 'Orchestration resumed');

      res.json({ paused: this.isPaused, status: this.state.status });
    });

    // Get config (sanitized to prevent secret exposure)
    this.app.get('/api/config', (req, res) => {
      res.json(sanitizeForLogging(this.config));
    });

    // Update config
    this.app.patch('/api/config', (req, res) => {
      const updates = req.body;
      Object.assign(this.config, updates);
      this.broadcast({ type: 'config', data: sanitizeForLogging(this.config) });
      res.json(sanitizeForLogging(this.config));
    });

    // Reload config from file
    this.app.post('/api/config/reload', (req, res) => {
      this.loadProjectConfig();
      this.broadcast({ type: 'config', data: sanitizeForLogging(this.config) });
      res.json(sanitizeForLogging(this.config));
    });

    // Clear logs
    this.app.post('/api/logs/clear', (req, res) => {
      this.logs = [];
      this.addLog('Logs cleared');
      res.json({ message: 'Logs cleared' });
    });

    // Serve dashboard (catch-all)
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/dashboard/index.html'));
    });
  }

  async startOrchestration(options = {}) {
    this.isRunning = true;
    this.isPaused = false;
    this.state.status = 'running';
    this.state.startTime = new Date().toISOString();
    this.state.endTime = null;
    this.state.duration = null;
    this.state.epics = [];
    this.state.stories = [];
    this.state.progress = {
      totalEpics: 0,
      completedEpics: 0,
      totalStories: 0,
      completedStories: 0,
      failedStories: 0,
      inProgressStories: 0,
    };

    this.broadcast({ type: 'state', data: this.state });

    try {
      // Reload config
      this.loadProjectConfig();

      // Parse plan to get totals
      const epics = parseEpicsFile(this.config.epicsPath);
      const status = parseSprintStatus(this.config.sprintStatusPath);
      const plan = buildExecutionPlan(epics, status, options);

      this.state.progress.totalEpics = plan.epics.length;
      this.state.progress.totalStories = plan.totalStories;

      // Initialize epic/story state
      for (const epic of plan.epics) {
        this.state.epics.push({
          id: epic.id,
          number: epic.number,
          title: epic.title,
          status: 'pending',
          storyCount: epic.stories.length,
        });
        for (const story of epic.stories) {
          this.state.stories.push({
            id: story.id,
            slug: story.slug,
            title: story.title,
            epicNumber: story.epicNumber,
            status: 'pending',
            step: null,
            prUrl: null,
          });
        }
      }

      this.broadcast({ type: 'state', data: this.state });

      // Create orchestrator with custom logger
      this.orchestrator = new Orchestrator(this.projectRoot, {
        ...this.config,
        ...options,
        autoRun: true,
      });

      // Override the log function to capture and broadcast
      const originalLog = this.orchestrator.log.bind(this.orchestrator);
      this.orchestrator.log = (message) => {
        originalLog(message);
        this.addLog(message);
        this.updateStateFromLog(message);
      };

      const result = await this.orchestrator.run();

      this.state.status = 'completed';
      this.state.endTime = new Date().toISOString();
      this.state.duration = this.calculateDuration();
      this.addLog(`Orchestration completed in ${this.state.duration}`);
    } catch (error) {
      this.state.status = 'failed';
      this.state.endTime = new Date().toISOString();
      this.state.duration = this.calculateDuration();
      this.addLog(`Orchestration failed: ${error.message}`);
    }

    this.isRunning = false;
    this.broadcast({ type: 'state', data: this.state });
  }

  calculateDuration() {
    if (!this.state.startTime) return null;
    const start = new Date(this.state.startTime);
    const end = this.state.endTime ? new Date(this.state.endTime) : new Date();
    const ms = end - start;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  updateStateFromLog(message) {
    // Parse log messages to update state

    // Batch info
    const batchMatch = message.match(/BATCH (\d+)\/(\d+): Running Epics ([\d\s+]+)/);
    if (batchMatch) {
      this.state.currentBatch = {
        number: parseInt(batchMatch[1]),
        total: parseInt(batchMatch[2]),
        epics: batchMatch[3].split('+').map(s => parseInt(s.trim())),
      };
    }

    // Epic started
    const epicStartMatch = message.match(/Starting Epic (\d+):/);
    if (epicStartMatch) {
      const epicNum = parseInt(epicStartMatch[1]);
      const epic = this.state.epics.find(e => e.number === epicNum);
      if (epic) {
        epic.status = 'running';
      }
    }

    // Phase 1: Creating stories
    const phase1Match = message.match(/\[Epic (\d+)\] PHASE 1: Creating (\d+) story files/);
    if (phase1Match) {
      const epicNum = parseInt(phase1Match[1]);
      const epic = this.state.epics.find(e => e.number === epicNum);
      if (epic) {
        epic.phase = 'creating-stories';
      }
    }

    // Phase 2: Running stories
    const phase2Match = message.match(/\[Epic (\d+)\] PHASE 2: Running (\d+) stories/);
    if (phase2Match) {
      const epicNum = parseInt(phase2Match[1]);
      const epic = this.state.epics.find(e => e.number === epicNum);
      if (epic) {
        epic.phase = 'running-stories';
      }
    }

    // Story file created
    const storyCreatedMatch = message.match(/✓ Story (\d+-\d+) file created/);
    if (storyCreatedMatch) {
      const storyId = storyCreatedMatch[1];
      const story = this.state.stories.find(s => s.id === storyId);
      if (story) {
        story.status = 'ready';
      }
    }

    // Story started
    const storyStartMatch = message.match(/Starting story (\d+-\d+):/);
    if (storyStartMatch) {
      const storyId = storyStartMatch[1];
      const story = this.state.stories.find(s => s.id === storyId);
      if (story) {
        story.status = 'running';
        story.step = 'starting';
        this.state.progress.inProgressStories++;
      }
    }

    // Story step
    const stepMatch = message.match(/\[(\d+-\d+)\] ([\w-]+)\.\.\./);
    if (stepMatch) {
      const [, storyId, step] = stepMatch;
      const story = this.state.stories.find(s => s.id === storyId);
      if (story) {
        story.step = step;
      }
    }

    // Review iteration
    const reviewMatch = message.match(/\[(\d+-\d+)\] Review iteration (\d+)\/(\d+)/);
    if (reviewMatch) {
      const [, storyId, current, max] = reviewMatch;
      const story = this.state.stories.find(s => s.id === storyId);
      if (story) {
        story.step = `review ${current}/${max}`;
      }
    }

    // Story completed
    const completedMatch = message.match(/Completed story (\d+-\d+)/);
    if (completedMatch) {
      const storyId = completedMatch[1];
      const story = this.state.stories.find(s => s.id === storyId);
      if (story && story.status !== 'completed') {
        story.status = 'completed';
        story.step = 'done';
        this.state.progress.completedStories++;
        this.state.progress.inProgressStories = Math.max(0, this.state.progress.inProgressStories - 1);
      }
    }

    // Story failed
    const failedMatch = message.match(/Failed story (\d+-\d+): (.+)/);
    if (failedMatch) {
      const [, storyId, error] = failedMatch;
      const story = this.state.stories.find(s => s.id === storyId);
      if (story && story.status !== 'failed') {
        story.status = 'failed';
        story.error = error;
        this.state.progress.failedStories++;
        this.state.progress.inProgressStories = Math.max(0, this.state.progress.inProgressStories - 1);
      }
    }

    // Epic completed
    const epicCompleteMatch = message.match(/\[Epic (\d+)\] COMPLETED/);
    if (epicCompleteMatch) {
      const epicNum = parseInt(epicCompleteMatch[1]);
      const epic = this.state.epics.find(e => e.number === epicNum);
      if (epic) {
        epic.status = 'completed';
        this.state.progress.completedEpics++;
      }
    }

    // Epic failed
    const epicFailMatch = message.match(/\[Epic (\d+)\] FAILED: (.+)/);
    if (epicFailMatch) {
      const [, epicNum, error] = epicFailMatch;
      const epic = this.state.epics.find(e => e.number === parseInt(epicNum));
      if (epic) {
        epic.status = 'failed';
        epic.error = error;
      }
    }

    // Update duration
    this.state.duration = this.calculateDuration();

    this.broadcast({ type: 'state', data: this.state });
  }

  addLog(message) {
    const entry = {
      id: this.logs.length,
      time: new Date().toISOString(),
      message,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    this.broadcast({ type: 'log', data: entry });
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        try {
          client.send(data);
        } catch (e) {
          // Ignore send errors
        }
      }
    }
  }

  start() {
    this.server.listen(this.port, '0.0.0.0', () => {
      const ifaces = this.getNetworkInterfaces();
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║              BMAD ORCHESTRATOR DASHBOARD                     ║
╚══════════════════════════════════════════════════════════════╝

  Dashboard URLs:
    Local:    http://localhost:${this.port}
${ifaces.map(ip => `    Network:  http://${ip}:${this.port}`).join('\n')}

  Login:    ${this.authUser} / ${this.authPass}

  Project:  ${this.projectRoot}
  Config:   ${this.config.configFile || 'using defaults'}

  API Endpoints:
    GET  /api/status     - Current state
    GET  /api/plan       - Execution plan
    GET  /api/logs       - Recent logs
    POST /api/start      - Start orchestration
    POST /api/stop       - Stop orchestration
    POST /api/pause      - Pause/Resume

  The dashboard will remain running even if you disconnect.
  Press Ctrl+C to stop the server.
`);
      this.addLog('Dashboard server started');
    });
  }

  getNetworkInterfaces() {
    try {
      const nets = os.networkInterfaces();
      const results = [];
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            results.push(net.address);
          }
        }
      }
      return results;
    } catch {
      return [];
    }
  }
}

// CLI entry point
import { Command } from 'commander';

const program = new Command();

program
  .name('bmad-orchestrator')
  .description('BMAD Orchestrator Dashboard - Monitor and control parallel epic/story execution')
  .version('1.0.0')
  .argument('[project-path]', 'Path to BMAD project', process.cwd())
  .option('-p, --port <port>', 'Dashboard port', '3456')
  .option('-u, --user <username>', 'Auth username (or DASH_USER env)', 'admin')
  .option('--pass <password>', 'Auth password (or DASH_PASS env)', 'bmad2024')
  .action((projectPath, options) => {
    const server = new DashboardServer(projectPath, {
      port: parseInt(options.port),
      user: options.user,
      pass: options.pass,
    });
    server.start();
  });

program.parse();

export { DashboardServer };
