import fs from 'fs/promises';
import path from 'path';
import { Graph } from './Graph.js';

/**
 * Handles diagram file operations and SVG content parsing
 * Works directly with file paths
 */
export class GraphFileManager {
  static default = new GraphFileManager();

  /**
   * Load a graph from a .drawio file
   * @param {string} filePath - Path to the .drawio file
   * @param {string|number} tab - Optional tab name or index (defaults to first tab)
   */
  async loadGraph(filePath: string, tab?: string | number) {
    // Resolve relative paths relative to process.cwd()
    const resolvedPath = path.resolve(filePath);
    await fs.access(resolvedPath);

    // Read the .drawio XML file
    const drawioXML = await fs.readFile(resolvedPath, 'utf8');

    // Parse all diagrams
    const diagrams = this.parseDiagrams(drawioXML);

    if (diagrams.length === 0) {
      throw new Error('Invalid .drawio file format: no diagrams found');
    }

    // Select the diagram based on tab parameter
    let selectedDiagram;
    if (tab === undefined) {
      // Default to first diagram
      selectedDiagram = diagrams[0];
    } else if (typeof tab === 'number') {
      // Select by index
      if (tab < 0 || tab >= diagrams.length) {
        throw new Error(`Tab index ${tab} out of range (0-${diagrams.length - 1})`);
      }
      selectedDiagram = diagrams[tab];
    } else {
      // Select by name
      selectedDiagram = diagrams.find(d => d.name === tab);
      if (!selectedDiagram) {
        const availableNames = diagrams.map(d => d.name).join(', ');
        throw new Error(`Tab "${tab}" not found. Available tabs: ${availableNames}`);
      }
    }

    return Graph.fromXML(selectedDiagram.mxGraphModelXML);
  }

  /**
   * Save a graph to a .drawio file
   * @param {Graph} graph - Graph instance to save
   * @param {string} filePath - Absolute or relative path to save the .drawio file
   * @param {string} tab - Optional tab name (defaults to "Page-1" for new files, or updates first tab for existing files)
   */
  async saveGraph(graph: Graph, filePath: string, tab?: string) {
    // Resolve relative paths relative to process.cwd()
    const resolvedPath = path.resolve(filePath);
    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    // Get mxGraphModel XML from graph
    const mxGraphModelXML = graph.toXML();

    const timestamp = new Date().toISOString();

    // Check if file exists
    let existingXML: string | null = null;
    try {
      existingXML = await fs.readFile(resolvedPath, 'utf8');
    } catch (e) {
      // File doesn't exist, will create new
    }

    let drawioXML: string;

    if (existingXML) {
      // File exists - update specific tab or first tab
      const diagrams = this.parseDiagrams(existingXML);
      const targetTabName = tab || (diagrams.length > 0 ? diagrams[0].name : 'Page-1');

      // Find existing diagram with this name
      const existingIndex = diagrams.findIndex(d => d.name === targetTabName);

      if (existingIndex >= 0) {
        // Update existing tab
        diagrams[existingIndex].mxGraphModelXML = mxGraphModelXML;
      } else {
        // Add new tab
        const diagramId = 'diagram-' + Date.now();
        diagrams.push({
          id: diagramId,
          name: targetTabName,
          mxGraphModelXML
        });
      }

      // Reconstruct the file with all diagrams
      const diagramElements = diagrams.map(d =>
        `  <diagram id="${d.id}" name="${this.escapeXml(d.name)}">\n${d.mxGraphModelXML}\n  </diagram>`
      ).join('\n');

      drawioXML = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="drawio-mcp" modified="${timestamp}" agent="drawio-mcp" version="1.0.0">
${diagramElements}
</mxfile>`;
    } else {
      // New file - create with single tab
      const diagramId = 'diagram-' + Date.now();
      const tabName = tab || 'Page-1';

      drawioXML = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="drawio-mcp" modified="${timestamp}" agent="drawio-mcp" version="1.0.0">
  <diagram id="${diagramId}" name="${this.escapeXml(tabName)}">
${mxGraphModelXML}
  </diagram>
</mxfile>`;
    }

    await fs.writeFile(resolvedPath, drawioXML, 'utf8');
  }


  /**
   * Get diagram statistics from file
   * @param {string} filePath - Absolute or relative path to the file
   * @param {string|number} tab - Optional tab name or index
   * @returns {Object} - Object with nodeCount and edgeCount
   */
  async getDiagramStats(filePath: string, tab?: string | number) {
    try {
      const graph = await this.loadGraph(filePath, tab);
      const cells = graph.model.cells;
      const nodeCount = Object.values(cells).filter((cell: any) => cell && cell.vertex).length;
      const edgeCount = Object.values(cells).filter((cell: any) => cell && cell.edge).length;
      return { nodeCount, edgeCount };
    } catch {
      return { nodeCount: 0, edgeCount: 0 };
    }
  }

  /**
   * List all tabs in a .drawio file
   * @param {string} filePath - Path to the .drawio file
   * @returns {Array} - Array of tab information
   */
  async listTabs(filePath: string) {
    const resolvedPath = path.resolve(filePath);
    await fs.access(resolvedPath);

    const drawioXML = await fs.readFile(resolvedPath, 'utf8');
    const diagrams = this.parseDiagrams(drawioXML);

    return diagrams.map((d, index) => {
      // Count nodes and edges in this diagram
      try {
        const graph = Graph.fromXML(d.mxGraphModelXML);
        const cells = graph.model.cells;
        const nodeCount = Object.values(cells).filter((cell: any) => cell && cell.vertex).length;
        const edgeCount = Object.values(cells).filter((cell: any) => cell && cell.edge).length;

        return {
          name: d.name,
          index,
          id: d.id,
          nodeCount,
          edgeCount
        };
      } catch (e) {
        return {
          name: d.name,
          index,
          id: d.id,
          nodeCount: 0,
          edgeCount: 0,
          error: 'Failed to parse diagram'
        };
      }
    });
  }

  /**
   * Parse all diagram elements from .drawio XML
   * @param {string} drawioXML - Raw .drawio file content
   * @returns {Array} - Array of diagram objects with id, name, and mxGraphModelXML
   */
  parseDiagrams(drawioXML: string) {
    const diagrams: Array<{ id: string; name: string; mxGraphModelXML: string }> = [];

    // Match all <diagram> elements
    const diagramRegex = /<diagram\s+([^>]*)>([\s\S]*?)<\/diagram>/g;
    let match;

    while ((match = diagramRegex.exec(drawioXML)) !== null) {
      const attributes = match[1];
      const content = match[2];

      // Extract id and name attributes
      const idMatch = attributes.match(/id="([^"]*)"/);
      const nameMatch = attributes.match(/name="([^"]*)"/);

      const id = idMatch ? idMatch[1] : '';
      const name = nameMatch ? this.unescapeXml(nameMatch[1]) : 'Untitled';

      // Extract mxGraphModel from content
      const modelMatch = content.match(/<mxGraphModel[^>]*>[\s\S]*<\/mxGraphModel>/);

      if (modelMatch) {
        diagrams.push({
          id,
          name,
          mxGraphModelXML: modelMatch[0]
        });
      }
    }

    return diagrams;
  }

  /**
   * Escape XML special characters
   */
  escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Unescape XML special characters
   */
  unescapeXml(str: string): string {
    return str
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  /**
   * Extract mxGraphModel from .drawio XML
   * @param {string} drawioXML - Raw .drawio file content
   * @returns {string|null} - mxGraphModel XML or null if extraction fails
   */
  extractMxGraphModel(drawioXML: string): string | null {
    // Extract the mxGraphModel element using regex
    const modelMatch = drawioXML.match(/<mxGraphModel[^>]*>[\s\S]*<\/mxGraphModel>/);

    if (!modelMatch) {
      return null;
    }

    return modelMatch[0];
  }
}
