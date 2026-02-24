import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GraphFileManager } from "../GraphFileManager.js";
import { Tool } from "./McpServer.js";

export class CopyTableTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'copy_table',
      description: 'Copy a table from one location to another, preserving structure and optionally renaming',
      inputSchema: {
        type: 'object',
        properties: {
          source_file: {
            type: 'string',
            description: 'Path to the source diagram file'
          },
          source_tab: {
            type: ['string', 'number'],
            description: 'Optional source tab name or index (defaults to first tab)'
          },
          table_id: {
            type: 'string',
            description: 'ID of the table to copy'
          },
          target_file: {
            type: 'string',
            description: 'Path to the target diagram file'
          },
          target_tab: {
            type: ['string', 'number'],
            description: 'Optional target tab name or index (defaults to first tab, creates if doesn\'t exist)'
          },
          new_id: {
            type: 'string',
            description: 'New ID for the copied table (required to avoid conflicts)'
          },
          x: {
            type: 'number',
            description: 'X coordinate for the copied table'
          },
          y: {
            type: 'number',
            description: 'Y coordinate for the copied table'
          },
          new_title: {
            type: 'string',
            description: 'Optional new title/label for the table container'
          }
        },
        required: ['source_file', 'table_id', 'target_file', 'new_id', 'x', 'y']
      }
    };
  }

  async execute({ source_file, source_tab, table_id, target_file, target_tab, new_id, x, y, new_title }) {
    if (!source_file || !table_id || !target_file || !new_id) {
      throw new McpError(ErrorCode.InvalidParams, 'source_file, table_id, target_file, and new_id are required');
    }

    if (x === undefined || y === undefined) {
      throw new McpError(ErrorCode.InvalidParams, 'x and y coordinates are required');
    }

    try {
      // Load source graph and get table info
      const sourceGraph = await this.fileManager.loadGraph(source_file, source_tab);
      const tableInfo = sourceGraph.getTableInfo(table_id);

      // Get container title and custom data
      const sourceContainer = sourceGraph.model.getCell(table_id);
      const containerTitle = new_title !== undefined ? new_title : (sourceContainer?.getValue() || '');
      const containerData = sourceContainer?.data ? JSON.parse(sourceContainer.data) : {};
      const customData = { ...containerData };
      delete customData.table; // Remove internal table metadata

      // Load or create target graph
      let targetGraph;
      try {
        targetGraph = await this.fileManager.loadGraph(target_file, target_tab);
      } catch (e) {
        // If target file doesn't exist, create it
        targetGraph = await this.fileManager.loadGraph(source_file, source_tab);
        // Clear the graph by creating a new empty one
        const { Graph } = await import('../Graph.js');
        targetGraph = new Graph();
      }

      // Copy table to target
      targetGraph.addTable({
        id: new_id,
        x: Number(x),
        y: Number(y),
        headers: tableInfo.columns,
        rows: tableInfo.rows,
        cellWidth: tableInfo.cellWidth,
        cellHeight: tableInfo.cellHeight,
        data: customData
      });

      // Update container title
      if (containerTitle) {
        const newContainer = targetGraph.model.getCell(new_id);
        if (newContainer) {
          newContainer.setValue(containerTitle);
        }
      }

      // Save target graph
      await this.fileManager.saveGraph(targetGraph, target_file, typeof target_tab === 'string' ? target_tab : undefined);

      return {
        content: [
          {
            type: 'text',
            text: `Table '${table_id}' copied to '${new_id}' in ${target_file}${target_tab ? ` (tab: ${target_tab})` : ''} with ${tableInfo.columns.length} columns and ${tableInfo.rows.length} rows`
          }
        ]
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to copy table: ${error.message}`);
    }
  }
}
