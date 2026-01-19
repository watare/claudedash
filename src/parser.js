import fs from 'fs';
import yaml from 'js-yaml';

/**
 * Simple mutex for serializing file operations
 * Prevents race conditions when multiple stories update sprint-status.yaml
 */
class FileMutex {
  constructor() {
    this.locks = new Map();
  }

  async acquire(filePath) {
    while (this.locks.has(filePath)) {
      await this.locks.get(filePath);
    }
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    promise.resolve = resolve;
    this.locks.set(filePath, promise);
    return () => {
      this.locks.delete(filePath);
      resolve();
    };
  }
}

const fileMutex = new FileMutex();

/**
 * Parse epics.md file to extract epic and story structure
 */
export function parseEpicsFile(epicsPath) {
  const content = fs.readFileSync(epicsPath, 'utf8');
  const epics = [];
  let currentEpic = null;
  let currentStory = null;
  let inStorySection = false;

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match Epic headers: ## Epic 1: Title or ### Epic 1: Title
    const epicMatch = line.match(/^#{2,3}\s+Epic\s+(\d+):\s+(.+)$/i);
    if (epicMatch) {
      // Push current story to current epic before switching epics
      if (currentStory && currentEpic) {
        currentEpic.stories.push(currentStory);
      }
      if (currentEpic) {
        epics.push(currentEpic);
      }
      currentEpic = {
        id: `epic-${epicMatch[1]}`,
        number: parseInt(epicMatch[1]),
        title: epicMatch[2].trim(),
        stories: [],
        description: '',
      };
      currentStory = null;
      inStorySection = false;
      continue;
    }

    // Match Story headers: ### Story 1.1: Title or #### Story 1.1: Title
    const storyMatch = line.match(/^#{3,4}\s+Story\s+(\d+)\.(\d+):\s+(.+)$/i);
    if (storyMatch && currentEpic) {
      if (currentStory) {
        currentEpic.stories.push(currentStory);
      }
      const epicNum = parseInt(storyMatch[1]);
      const storyNum = parseInt(storyMatch[2]);
      currentStory = {
        id: `${epicNum}-${storyNum}`,
        epicNumber: epicNum,
        storyNumber: storyNum,
        title: storyMatch[3].trim(),
        slug: slugify(`${epicNum}-${storyNum}-${storyMatch[3]}`),
        acceptanceCriteria: [],
        atomicCommit: '',
      };
      inStorySection = true;
      continue;
    }

    // Extract atomic commit message
    const commitMatch = line.match(/^\*\*Atomic Commit:\*\*\s*`?(.+?)`?\s*$/);
    if (commitMatch && currentStory) {
      currentStory.atomicCommit = commitMatch[1].trim();
      continue;
    }

    // Extract acceptance criteria (Given/When/Then)
    if (currentStory && inStorySection) {
      const givenMatch = line.match(/^\*\*Given\*\*\s+(.+)$/);
      if (givenMatch) {
        currentStory.acceptanceCriteria.push({
          type: 'given',
          text: givenMatch[1],
        });
      }
    }
  }

  // Don't forget last story and epic
  if (currentStory && currentEpic) {
    currentEpic.stories.push(currentStory);
  }
  if (currentEpic) {
    epics.push(currentEpic);
  }

  return epics;
}

/**
 * Parse sprint-status.yaml to get current status of all items
 */
export function parseSprintStatus(statusPath) {
  const content = fs.readFileSync(statusPath, 'utf8');
  const data = yaml.load(content);

  // Handle both old and new format
  const status = data.development_status || data;
  const result = {};

  for (const [key, value] of Object.entries(status)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Update sprint status file with mutex lock to prevent race conditions
 * @param {string} statusPath - Path to sprint-status.yaml
 * @param {Object} updates - Key-value pairs to update
 * @returns {Promise<void>}
 */
export async function updateSprintStatus(statusPath, updates) {
  const release = await fileMutex.acquire(statusPath);
  try {
    const content = fs.readFileSync(statusPath, 'utf8');
    const data = yaml.load(content);

    if (!data.development_status) {
      data.development_status = {};
    }

    Object.assign(data.development_status, updates);

    fs.writeFileSync(statusPath, yaml.dump(data, { lineWidth: -1 }));
  } finally {
    release();
  }
}

/**
 * Convert title to URL-friendly slug
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

/**
 * Build execution plan from epics and current status
 */
export function buildExecutionPlan(epics, status, options = {}) {
  const {
    startFromEpic = 1,
    endAtEpic = Infinity,
    skipCompleted = true,
    onlyEpics = null,  // Array of epic numbers to run
  } = options;

  const plan = {
    epics: [],
    totalStories: 0,
    storiesReady: 0,
    storiesInProgress: 0,
    storiesCompleted: 0,
  };

  for (const epic of epics) {
    if (epic.number < startFromEpic || epic.number > endAtEpic) continue;
    if (onlyEpics && !onlyEpics.includes(epic.number)) continue;

    const epicStatus = status[epic.id] || 'backlog';
    if (skipCompleted && epicStatus === 'done') continue;

    const epicPlan = {
      ...epic,
      status: epicStatus,
      stories: [],
    };

    for (const story of epic.stories) {
      const storyStatus = status[story.slug] || status[story.id] || 'backlog';
      if (skipCompleted && storyStatus === 'done') {
        plan.storiesCompleted++;
        continue;
      }

      epicPlan.stories.push({
        ...story,
        status: storyStatus,
      });

      plan.totalStories++;
      if (storyStatus === 'ready-for-dev') plan.storiesReady++;
      if (storyStatus === 'in-progress') plan.storiesInProgress++;
    }

    if (epicPlan.stories.length > 0) {
      plan.epics.push(epicPlan);
    }
  }

  return plan;
}
