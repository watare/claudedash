/**
 * Projects service - provides project data from orchestrator state
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getAgentsByProject } from './agents.js';

/**
 * Parse acceptance criteria from a story markdown file
 * @param {string} storyPath - Path to the story markdown file
 * @returns {string[]} Array of acceptance criteria strings
 */
function parseAcceptanceCriteria(storyPath) {
  try {
    if (!fs.existsSync(storyPath)) {
      return [];
    }
    const content = fs.readFileSync(storyPath, 'utf8');

    // Find the ## Acceptance Criteria section
    const acMatch = content.match(/## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |\n---|\$)/);
    if (!acMatch) {
      return [];
    }

    const acSection = acMatch[1];
    // Parse numbered list items (1. **Given**... format)
    const criteria = [];
    const lines = acSection.split('\n');
    let currentCriterion = '';

    for (const line of lines) {
      const trimmed = line.trim();
      // Match numbered items like "1. **Given**..." or "1. Given..."
      if (/^\d+\.\s+/.test(trimmed)) {
        if (currentCriterion) {
          criteria.push(currentCriterion.trim());
        }
        currentCriterion = trimmed.replace(/^\d+\.\s+/, '');
      } else if (trimmed && currentCriterion) {
        // Continuation of previous criterion
        currentCriterion += ' ' + trimmed;
      }
    }

    if (currentCriterion) {
      criteria.push(currentCriterion.trim());
    }

    return criteria;
  } catch (error) {
    console.warn(`[projects] Failed to parse acceptance criteria from ${storyPath}: ${error.message}`);
    return [];
  }
}

/**
 * Find story file path for a given story ID
 * @param {string} projectRoot - Project root path
 * @param {string} storyId - Story ID like "2-7"
 * @returns {string|null} Path to story file or null if not found
 */
function findStoryFile(projectRoot, storyId) {
  const storiesDir = path.join(projectRoot, '_bmad-output', 'implementation-artifacts');
  try {
    if (!fs.existsSync(storiesDir)) {
      return null;
    }
    const files = fs.readdirSync(storiesDir);
    // Find file matching pattern like "2-7-*.md"
    const storyFile = files.find(f => f.startsWith(`${storyId}-`) && f.endsWith('.md'));
    return storyFile ? path.join(storiesDir, storyFile) : null;
  } catch {
    return null;
  }
}

/**
 * Parse sprint status from YAML file
 * @param {string} statusPath - Path to sprint-status.yaml
 * @returns {Object|null} Parsed development status or null if file doesn't exist
 */
function parseSprintStatus(statusPath) {
  try {
    if (!fs.existsSync(statusPath)) {
      return null;
    }
    const content = fs.readFileSync(statusPath, 'utf8');
    const data = yaml.load(content);
    return data.development_status || data;
  } catch (error) {
    console.warn(`[projects] Failed to parse sprint status: ${error.message}`);
    return null;
  }
}

/**
 * Derive project status from sprint status
 * @param {Object|null} sprintStatus - Parsed sprint status
 * @returns {string} Project status: running, paused, waiting, failed, done, idle
 */
function deriveProjectStatus(sprintStatus) {
  if (!sprintStatus) {
    return 'idle';
  }

  const values = Object.values(sprintStatus);

  // Check for in-progress work
  if (values.includes('in-progress')) {
    return 'running';
  }

  // Check for ready work
  if (values.includes('ready-for-dev')) {
    return 'waiting';
  }

  // Check if all epics are done
  const epicStatuses = Object.entries(sprintStatus)
    .filter(([key]) => key.startsWith('epic-') && !key.includes('retrospective'))
    .map(([, status]) => status);

  if (epicStatuses.length > 0 && epicStatuses.every((s) => s === 'done')) {
    return 'done';
  }

  return 'waiting';
}

/**
 * Find current epic and story from sprint status
 * @param {Object|null} sprintStatus - Parsed sprint status
 * @returns {{ currentEpic: number|null, currentStory: string|null }}
 */
function findCurrentWork(sprintStatus) {
  if (!sprintStatus) {
    return { currentEpic: null, currentStory: null };
  }

  // Find first in-progress story
  for (const [key, status] of Object.entries(sprintStatus)) {
    if (status === 'in-progress' && !key.startsWith('epic-')) {
      const match = key.match(/^(\d+)-(\d+)/);
      if (match) {
        return {
          currentEpic: parseInt(match[1]),
          currentStory: `${match[1]}-${match[2]}`,
        };
      }
    }
  }

  // Find first in-progress epic
  for (const [key, status] of Object.entries(sprintStatus)) {
    if (status === 'in-progress' && key.startsWith('epic-')) {
      const match = key.match(/epic-(\d+)/);
      if (match) {
        return {
          currentEpic: parseInt(match[1]),
          currentStory: null,
        };
      }
    }
  }

  return { currentEpic: null, currentStory: null };
}

/**
 * Capitalize first letter of each word
 * @param {string} str - Input string
 * @returns {string} Title-cased string
 */
function toTitleCase(str) {
  return str
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Build epic and story structure from sprint status
 * @param {Object|null} sprintStatus - Parsed sprint status
 * @param {string} projectRoot - Project root path for loading story files
 * @returns {Array} Array of epics with stories
 */
function buildEpicsFromStatus(sprintStatus, projectRoot) {
  if (!sprintStatus) {
    return [];
  }

  const epicsMap = new Map();

  // First pass: gather all epic entries
  for (const [key, status] of Object.entries(sprintStatus)) {
    const epicMatch = key.match(/^epic-(\d+)$/);
    if (epicMatch) {
      const epicNum = parseInt(epicMatch[1]);
      if (!epicsMap.has(epicNum)) {
        epicsMap.set(epicNum, {
          number: epicNum,
          title: `Epic ${epicNum}`,
          status: status,
          stories: [],
        });
      } else {
        epicsMap.get(epicNum).status = status;
      }
    }
  }

  // Second pass: gather all story entries
  for (const [key, status] of Object.entries(sprintStatus)) {
    const storyMatch = key.match(/^(\d+)-(\d+)/);
    if (storyMatch && !key.startsWith('epic-')) {
      const epicNum = parseInt(storyMatch[1]);
      const storyNum = parseInt(storyMatch[2]);

      if (!epicsMap.has(epicNum)) {
        epicsMap.set(epicNum, {
          number: epicNum,
          title: `Epic ${epicNum}`,
          status: 'backlog',
          stories: [],
        });
      }

      // Extract title from key: "2-2-projects-zustand-store" -> "Projects Zustand Store"
      const rawTitle = key.replace(/^\d+-\d+-/, '').replace(/-/g, ' ');
      const storyId = `${epicNum}-${storyNum}`;

      // Load acceptance criteria from story file if it exists
      const storyFilePath = findStoryFile(projectRoot, storyId);
      const acceptanceCriteria = storyFilePath ? parseAcceptanceCriteria(storyFilePath) : [];

      epicsMap.get(epicNum).stories.push({
        id: storyId,
        title: toTitleCase(rawTitle),
        status: status,
        acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
      });
    }
  }

  // Convert to sorted array
  const epics = Array.from(epicsMap.values()).sort((a, b) => a.number - b.number);

  // Sort stories within each epic
  for (const epic of epics) {
    epic.stories.sort((a, b) => {
      const aNum = parseInt(a.id.split('-')[1]);
      const bNum = parseInt(b.id.split('-')[1]);
      return aNum - bNum;
    });
  }

  return epics;
}

/**
 * Get sprint status file path for a project
 * @param {string} projectRoot - Project root path
 * @returns {string} Path to sprint-status.yaml
 */
function getSprintStatusPath(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
}

/**
 * Get all projects with summary information
 * @returns {Promise<Array>} List of projects with basic info
 */
export async function getAllProjects() {
  const projects = [];

  // Get project from environment or default
  const projectRoot = process.cwd();
  const projectName = projectRoot.split('/').pop();

  // Try to read sprint status
  const statusPath = getSprintStatusPath(projectRoot);
  const sprintStatus = parseSprintStatus(statusPath);
  const { currentEpic, currentStory } = findCurrentWork(sprintStatus);

  projects.push({
    id: projectName,
    name: projectName,
    path: projectRoot,
    status: deriveProjectStatus(sprintStatus),
    currentEpic,
    currentStory,
    agentCount: 0, // Will be populated when orchestrator tracks agents
    lastActivity: new Date().toISOString(),
  });

  return projects;
}

/**
 * Get a single project by ID with detailed epic/story breakdown
 * @param {string} id - Project ID
 * @returns {Promise<Object|null>} Project details or null if not found
 */
export async function getProjectById(id) {
  const projects = await getAllProjects();
  const project = projects.find((p) => p.id === id);

  if (!project) {
    return null;
  }

  // Read sprint status for detailed epic/story breakdown
  const statusPath = getSprintStatusPath(project.path);
  const sprintStatus = parseSprintStatus(statusPath);
  const epics = buildEpicsFromStatus(sprintStatus, project.path);

  // Get active agents for this project
  const agents = await getAgentsByProject(id);

  return {
    ...project,
    epics,
    agents,
  };
}
