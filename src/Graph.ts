import { mxGraph, mxCodec, mxUtils, mxHierarchicalLayout, mxConstants, mxCircleLayout, mxGeometry, mxFastOrganicLayout, mxCompactTreeLayout, mxRadialTreeLayout, mxPartitionLayout, mxStackLayout } from './mxgraph/index.js';

const LAYOUT_HIERARCHICAL = 'hierarchical'
const LAYOUT_CIRCLE = 'circle'
const LAYOUT_ORGANIC = 'organic'
const LAYOUT_COMPACT_TREE = 'compact-tree'
const LAYOUT_RADIAL_TREE = 'radial-tree'
const LAYOUT_PARTITION = 'partition'
const LAYOUT_STACK = 'stack'

const DIRECTION_TOP_DOWN = 'top-down'
const DIRECTION_LEFT_RIGHT = 'left-right'

const DIR_TO_MX_DIRECTION = {
  [DIRECTION_TOP_DOWN]: mxConstants.DIRECTION_NORTH,
  [DIRECTION_LEFT_RIGHT]: mxConstants.DIRECTION_WEST
}

const DEFAULT_CORNER_RADIUS = 12
const KIND_ROUNDED_RECTANGLE = 'RoundedRectangle'
const PROP_ARC_SIZE = 'arcSize'
const PROP_ABSOLUTE_ARC_SIZE = 'absoluteArcSize'


export type LinkNodesParams = {
  from: string;
  to: string;
  title?: string;
  style?: Record<string, any>;
  undirected?: boolean;
}

export class Graph {
  static Kinds = {
    Rectangle: { style: { rounded: 1, whiteSpace: 'wrap', html: 1 }, width: 120, height: 60 },
    Ellipse: { style: { ellipse: '', whiteSpace: 'wrap', html: 1 }, width: 120, height: 80 },
    Cylinder: { style: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;', width: 60, height: 80 },
    Cloud: { style: 'ellipse;shape=cloud;whiteSpace=wrap;html=1;', width: 120, height: 80 },
    Square: { style: 'whiteSpace=wrap;html=1;aspect=fixed;rounded=1;', width: 80, height: 80 },
    Circle: { style: 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;', width: 80, height: 80 },
    Step: { style: 'shape=step;perimeter=stepPerimeter;whiteSpace=wrap;html=1;fixedSize=1;', width: 120, height: 80 },
    Actor: { style: 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;', width: 30, height: 60 },
    Text: { style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;', width: 60, height: 30 },
    RoundedRectangle: { style: `whiteSpace=wrap;html=1;rounded=1;absoluteArcSize=1;arcSize=${DEFAULT_CORNER_RADIUS * 2}`, width: 120, height: 60 },
  }

  static normalizeKind(kind: string) {
    if (kind === 'Elipse') return 'Ellipse';
    return kind;
  }

  graph: typeof mxGraph;
  container: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.graph = new mxGraph(this.container);
  }

  get root() {
    return this.graph.getDefaultParent();
  }

  get model() {
    return this.graph.getModel()
  }

  toStyleString(data) {
    if (typeof data === 'string') return data
    return Object.entries(data).reduce((tmp, [key, value]) => {
      return value === undefined ? tmp : tmp += key + (value ? `=${value}` : '') + ';'
    }, '')
  }

  /**
   * Parses a style definition into a key-value object.
   * 
   * Handles both string and object style formats:
   * - String format: "key1=value1;key2=value2;" (semicolon-separated key=value pairs)
   * - Object format: { key1: "value1", key2: "value2" } (plain object)
   * 
   * For string styles, empty values (e.g., "key=") are converted to empty strings.
   * For object styles, the input is shallow copied to avoid mutation.
   * 
   * @param style - Style definition as either a semicolon-separated string or object
   * @returns Object with style properties as key-value pairs
   * 
   * @example
   * parseStyle("rounded=1;whiteSpace=wrap;html=1")
   * // Returns: { rounded: "1", whiteSpace: "wrap", html: "1" }
   * 
   * @example
   * parseStyle({ rounded: 1, whiteSpace: "wrap" })
   * // Returns: { rounded: 1, whiteSpace: "wrap" }
   */
  private parseStyle(style: any): Record<string, string> {
    if (typeof style === 'string') {
      return style.split(';').filter(Boolean).reduce((acc: Record<string, string>, kv) => {
        const [k, v] = kv.split('=');
        acc[k] = v === undefined ? '' : v;
        return acc;
      }, {});
    }
    return { ...style };
  }

  /**
   * Converts a style object into a semicolon-separated style string.
   * 
   * This function is the inverse of parseStyle(), converting a key-value object
   * back into the string format used by mxGraph. Properties with undefined values
   * are skipped, while properties with falsy values (empty string, 0, false) are
   * included with just the key name (no equals sign).
   * 
   * @param style - Object with style properties as key-value pairs
   * @returns Semicolon-separated style string in format "key1=value1;key2;key3=value3;"
   * 
   * @example
   * stringifyStyle({ rounded: "1", whiteSpace: "wrap", html: "1" })
   * // Returns: "rounded=1;whiteSpace=wrap;html=1;"
   * 
   * @example
   * stringifyStyle({ rounded: "", whiteSpace: "wrap" })
   * // Returns: "rounded;whiteSpace=wrap;"
   */
  private stringifyStyle(style: Record<string, any>): string {
    return Object.entries(style).reduce((tmp, [key, value]) => {
      return value === undefined ? tmp : tmp += key + (value ? `=${value}` : '') + ';'
    }, '');
  }

  

  /**
   * Adjusts the style string for a specific node kind, applying kind-specific modifications.
   * 
   * For RoundedRectangle nodes, this function modifies the corner radius by setting:
   * - absoluteArcSize to '1' to enable absolute arc sizing
   * - arcSize to the calculated value (corner_radius * 2, default to 24)
   * 
   * @param style - The base style string to modify
   * @param kind - The node kind (e.g., 'RoundedRectangle', 'Rectangle', etc.)
   * @param corner_radius - The desired corner radius in pixels (only applies to RoundedRectangle)
   * @returns The modified style string with kind-specific adjustments applied
   */
  private adjustStyleByKind(style: string, kind: string, corner_radius: number) : string {
    if (kind === KIND_ROUNDED_RECTANGLE) {
      const styleObj = this.parseStyle(style);
      if (corner_radius !== undefined) {
        const cr = parseInt(String(corner_radius), 10);
        styleObj[PROP_ABSOLUTE_ARC_SIZE] = '1';
        const arcSize = !isNaN(cr) && cr >= 1 ? cr * 2 : DEFAULT_CORNER_RADIUS * 2;
        styleObj[PROP_ARC_SIZE] = String(arcSize);
      }
      // console.error(`adjusted style: ${this.stringifyStyle(styleObj)}`);
      return this.stringifyStyle(styleObj);
    }
    return style;
  }

  /**
   * Validates that a parent node exists before creating children
   * @param parent - Parent node ID or 'root'
   * @returns The parent cell
   * @throws Error if parent doesn't exist
   */
  private validateParent(parent: string) {
    if (parent === 'root') return this.root;
    const parentCell = this.model.getCell(parent);
    if (!parentCell) {
      throw new Error(`Parent node '${parent}' does not exist`);
    }
    return parentCell;
  }


  addNode({ id, title, parent = 'root', kind = 'Rectangle', x = 10, y = 10, corner_radius, data, ...rest }: any) {
    const normalizedKind = Graph.normalizeKind(kind)
    const { style, width, height } = { ...Graph.Kinds[normalizedKind], ...rest }

    const to = this.validateParent(parent)
    const node = this.graph.insertVertex(to, id, title, Number(x), Number(y), width, height);
    node.setStyle(this.adjustStyleByKind(style, normalizedKind, corner_radius));

    // Store custom data properties on the cell
    if (data && typeof data === 'object') {
      node.data = JSON.stringify(data);
    }

    return node
  }

  editNode({ id, title, kind, x, y, width, height, corner_radius, data }: any) {
    const node = this.model.getCell(id);

    if (!node) throw new Error(`Node not found`);
    const normalizedKind = Graph.normalizeKind(kind)
    if (title) node.setValue(title);
    if (kind) node.setStyle(Graph.Kinds[normalizedKind].style);

    // if it's rounded, apply the corner radius
    const isRounded = normalizedKind === KIND_ROUNDED_RECTANGLE;
    if (isRounded && corner_radius !== undefined) {
      const currentStyleStr = node.getStyle && node.getStyle() ? String(node.getStyle()) : '';
      node.setStyle(this.adjustStyleByKind(currentStyleStr, normalizedKind, corner_radius));
    }
    // if the geometry is changed, update the geometry
    if (x !== undefined || y !== undefined || width !== undefined || height !== undefined) {
      const geometry = node.getGeometry();
      node.setGeometry(new mxGeometry(
        x ?? geometry.x,
        y ?? geometry.y,
        width ?? geometry.width,
        height ?? geometry.height
      ));
    }

    // Update custom data properties
    if (data !== undefined) {
      if (data === null) {
        // Remove data if explicitly set to null
        delete node.data;
      } else if (typeof data === 'object') {
        // Merge with existing data
        const existingData = node.data ? JSON.parse(node.data) : {};
        node.data = JSON.stringify({ ...existingData, ...data });
      }
    }

    return this
  }

  linkNodes({ from, to, title, style = {}, undirected }: LinkNodesParams) {
    
    const [fromNode, toNode] = [this.model.getCell(from), this.model.getCell(to)]

    // Compute candidate IDs
    const idDirect = `${from}-2-${to}`
    const idReverse = `${to}-2-${from}`
    const [a, b] = [from, to].sort()
    const idCanonical = `${a}-2-${b}`

    // Build effective style
    const effective: any = computeEffectiveLineStyle(style, undirected)

     // Try to find an existing edge to update (do not rename IDs)
    const existing = this.model.getCell(idDirect) || this.model.getCell(idReverse) || this.model.getCell(idCanonical)
    let link = existing
    if (link) {
      if (title !== undefined) link.setValue(title)
    } else { // Insert new edge; use canonical id for undirected, else direct id
      const idToUse = undirected ? idCanonical : idDirect
      link = this.graph.insertEdge(this.root, idToUse, title ? title : null, fromNode, toNode);
    }
    
    link.setStyle(this.toStyleString(effective))
    return link.getId()
  }

  removeNodes(ids: string[]) {
    const cells = ids.map(id => this.model.getCell(id));
    this.graph.removeCells(cells);
    return this
  }

  /**
   * Get detailed information about a node including custom data
   * @param {string} id - Node ID
   * @returns {object|null} - Node information or null if not found
   */
  getNodeInfo(id: string) {
    const cell = this.model.getCell(id);
    if (!cell || !cell.vertex) return null;

    const geometry = cell.getGeometry();
    const style = cell.getStyle();

    // Parse style to determine kind
    let kind = 'Rectangle';
    if (style) {
      const styleObj = this.parseStyle(style);
      if (styleObj.ellipse !== undefined) kind = 'Ellipse';
      else if (styleObj.shape === 'cylinder3') kind = 'Cylinder';
      else if (styleObj.shape === 'cloud') kind = 'Cloud';
      else if (styleObj.shape === 'step') kind = 'Step';
      else if (styleObj.shape === 'umlActor') kind = 'Actor';
      else if (styleObj.strokeColor === 'none' && styleObj.fillColor === 'none') kind = 'Text';
      else if (styleObj.aspect === 'fixed' && styleObj.ellipse !== undefined) kind = 'Circle';
      else if (styleObj.aspect === 'fixed') kind = 'Square';
      else if (styleObj.rounded === '1' && styleObj.absoluteArcSize === '1') kind = 'RoundedRectangle';
    }

    const result: any = {
      id: cell.getId(),
      title: cell.getValue() || '',
      kind,
      x: geometry ? geometry.x : 0,
      y: geometry ? geometry.y : 0,
      width: geometry ? geometry.width : 0,
      height: geometry ? geometry.height : 0,
      parent: cell.getParent()?.getId() || 'root'
    };

    // Include custom data if present
    if (cell.data) {
      try {
        result.data = JSON.parse(cell.data);
      } catch (e) {
        result.data = cell.data;
      }
    }

    return result;
  }

  /**
   * Get all nodes in the graph with their properties
   * @returns {Array} - Array of node information objects
   */
  getAllNodes() {
    const nodes: any[] = [];
    const cells = this.model.cells;

    for (const cellId in cells) {
      const cell = cells[cellId];
      if (cell && cell.vertex && cellId !== '0' && cellId !== '1') {
        const nodeInfo = this.getNodeInfo(cellId);
        if (nodeInfo) {
          nodes.push(nodeInfo);
        }
      }
    }

    return nodes;
  }

  /**
   * Find nodes matching filter criteria
   * @param {object} filters - Search criteria
   * @returns {Array} - Array of matching nodes
   */
  findNodes(filters: any = {}) {
    const allNodes = this.getAllNodes();

    return allNodes.filter(node => {
      // Filter by ID
      if (filters.id && node.id !== filters.id) return false;
      if (filters.id_contains && !node.id.includes(filters.id_contains)) return false;

      // Filter by title
      if (filters.title && node.title !== filters.title) return false;
      if (filters.title_contains) {
        const titleLower = node.title.toLowerCase();
        const searchLower = filters.title_contains.toLowerCase();
        if (!titleLower.includes(searchLower)) return false;
      }

      // Filter by kind
      if (filters.kind && node.kind !== filters.kind) return false;

      // Filter by position ranges
      if (filters.x_min !== undefined && node.x < filters.x_min) return false;
      if (filters.x_max !== undefined && node.x > filters.x_max) return false;
      if (filters.y_min !== undefined && node.y < filters.y_min) return false;
      if (filters.y_max !== undefined && node.y > filters.y_max) return false;

      // Filter by custom data properties
      if (filters.data && node.data) {
        for (const key in filters.data) {
          if (node.data[key] !== filters.data[key]) return false;
        }
      } else if (filters.data && !node.data) {
        return false;
      }

      return true;
    });
  }

  /**
   * Executes a given layout algorithm on the graph's root element.
   *
   * @param layout - An object with an `execute` method, typically an mxGraph layout instance.
   * @param args - Additional arguments to pass to the layout's `execute` method.
   * @returns The current Graph instance for method chaining.
   *
   * @remarks
   * This method is used internally to apply various mxGraph layout algorithms
   * (e.g., hierarchical, circle, organic) to the graph. The layout is executed
   * on the root element of the graph, and any additional arguments are forwarded
   * to the layout's `execute` method.
   */
  private runLayout(layout: { execute: (...params: any[]) => void }, ...args: any[]) {
    layout.execute(this.root, ...args);
    return this
  }


  /**
   * Applies a layout algorithm to the graph.
   *
   * @param params - An object containing the layout algorithm and optional options.
   * @param params.algorithm - The name of the layout algorithm to apply. Supported values are:
   *   - 'hierarchical'
   *   - 'circle'
   *   - 'organic'
   *   - 'compact-tree'
   *   - 'radial-tree'
   *   - 'partition'
   *   - 'stack'
   * @param params.options - Optional parameters for the layout algorithm.
   *   - For 'hierarchical', you may specify `direction` as either 'top-down' or 'left-right'.
   *
   * @throws {Error} If an unsupported algorithm is provided, or if an invalid direction is specified for hierarchical layout.
   *
   * @returns {Graph} The current Graph instance for method chaining.
   *
   * @example
   * graph.applyLayout({ algorithm: 'hierarchical', options: { direction: 'left-right' } });
   * graph.applyLayout({ algorithm: 'circle' });
   */
  applyLayout({ algorithm, options = {} }: { algorithm: string; options?: any }) {
    switch (algorithm) {
      case LAYOUT_HIERARCHICAL: {
        if (  options.direction !== undefined &&
              options.direction !== DIRECTION_TOP_DOWN && options.direction !== DIRECTION_LEFT_RIGHT )
            throw new Error( `Invalid hierarchical direction: ${options.direction}. Allowed: ${DIRECTION_TOP_DOWN}, ${DIRECTION_LEFT_RIGHT}` );

        this.runLayout(new mxHierarchicalLayout(this.graph, DIR_TO_MX_DIRECTION[options.direction]), Object.values(this.model.cells)[1]);
        break;
      }
      case LAYOUT_CIRCLE: {
        this.runLayout(new mxCircleLayout(this.graph));
        break;
      }
      case LAYOUT_ORGANIC: {
        this.runLayout(new mxFastOrganicLayout(this.graph));
        break;
      }
      case LAYOUT_COMPACT_TREE: {
        this.runLayout(new mxCompactTreeLayout(this.graph));
        break;
      }
      case LAYOUT_RADIAL_TREE: {
        this.runLayout(new mxRadialTreeLayout(this.graph));
        break;
      }
      case LAYOUT_PARTITION: {
        this.runLayout(new mxPartitionLayout(this.graph));
        break;
      }
      case LAYOUT_STACK: {
        this.runLayout(new mxStackLayout(this.graph));
        break;
      }
      default: {
        const supportedAlgorithms = [ LAYOUT_HIERARCHICAL, LAYOUT_CIRCLE, LAYOUT_ORGANIC,
                                      LAYOUT_COMPACT_TREE, LAYOUT_RADIAL_TREE, LAYOUT_PARTITION,
                                      LAYOUT_STACK,
                                    ];
        throw new Error( `Unsupported layout algorithm: ${algorithm}. Supported: ${supportedAlgorithms.join(', ')}` );
      }
    }
    return this;
  }

  /**
   * Create a new table with headers and data rows
   * @param params - Table creation parameters
   * @returns Table information object
   */
  addTable({ id, x, y, headers, rows = [], cellWidth = 120, cellHeight = 30, data = {} }) {
    if (!headers || headers.length === 0) {
      throw new Error('Table must have at least one column header');
    }

    const tableWidth = headers.length * cellWidth;
    const tableHeight = (rows.length + 1) * cellHeight;

    // Create container node with table metadata
    const tableMetadata = {
      ...data,
      table: {
        type: 'table',
        columns: headers,
        cellWidth,
        cellHeight
      }
    };

    const containerNode = this.addNode({
      id,
      title: '',
      kind: 'Rectangle',
      x,
      y,
      width: tableWidth,
      height: tableHeight,
      data: tableMetadata
    });

    // Create header cells
    for (let col = 0; col < headers.length; col++) {
      this.addNode({
        id: `${id}_header_c${col}`,
        title: headers[col],
        kind: 'Rectangle',
        parent: id,
        x: col * cellWidth,
        y: 0,
        width: cellWidth,
        height: cellHeight
      });
    }

    // Create data cells for each row
    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < headers.length; col++) {
        const cellValue = rows[row][col] || '';
        this.addNode({
          id: `${id}_r${row}_c${col}`,
          title: cellValue,
          kind: 'Rectangle',
          parent: id,
          x: col * cellWidth,
          y: (row + 1) * cellHeight,
          width: cellWidth,
          height: cellHeight
        });
      }
    }

    return this.getTableInfo(id);
  }

  /**
   * Get detailed information about a table
   * @param id - Table ID
   * @returns Table structure and data
   */
  getTableInfo(id: string) {
    const containerCell = this.model.getCell(id);
    if (!containerCell || !containerCell.vertex) {
      throw new Error(`Table '${id}' not found`);
    }

    // Parse table metadata
    let tableMetadata;
    try {
      const cellData = containerCell.data ? JSON.parse(containerCell.data) : {};
      tableMetadata = cellData.table;
      if (!tableMetadata || tableMetadata.type !== 'table') {
        throw new Error(`Node '${id}' is not a table`);
      }
    } catch (e) {
      throw new Error(`Node '${id}' is not a table`);
    }

    const { columns, cellWidth, cellHeight } = tableMetadata;
    const geometry = containerCell.getGeometry();

    // Reconstruct rows by reading child cells
    const rows: string[][] = [];
    const cells = this.model.cells;

    // Find all data cells (not headers)
    const dataCells: any[] = [];
    for (const cellId in cells) {
      if (cellId.startsWith(`${id}_r`)) {
        const cell = cells[cellId];
        if (cell && cell.vertex) {
          const match = cellId.match(/_r(\d+)_c(\d+)$/);
          if (match) {
            const rowIdx = parseInt(match[1], 10);
            const colIdx = parseInt(match[2], 10);
            dataCells.push({ rowIdx, colIdx, value: cell.getValue() || '' });
          }
        }
      }
    }

    // Build rows array
    if (dataCells.length > 0) {
      const maxRow = Math.max(...dataCells.map(c => c.rowIdx));
      for (let r = 0; r <= maxRow; r++) {
        const row: string[] = [];
        for (let c = 0; c < columns.length; c++) {
          const cellData = dataCells.find(dc => dc.rowIdx === r && dc.colIdx === c);
          row.push(cellData ? cellData.value : '');
        }
        rows.push(row);
      }
    }

    return {
      id,
      x: geometry ? geometry.x : 0,
      y: geometry ? geometry.y : 0,
      width: geometry ? geometry.width : 0,
      height: geometry ? geometry.height : 0,
      columns,
      rows,
      cellWidth,
      cellHeight
    };
  }

  /**
   * Add a column to an existing table
   */
  addTableColumn({ tableId, header, position = -1, defaultValue = '' }) {
    const tableInfo = this.getTableInfo(tableId);
    const { columns, cellWidth, cellHeight, rows } = tableInfo;

    // Determine insert position
    const insertPos = position === -1 ? columns.length : position;
    if (insertPos < 0 || insertPos > columns.length) {
      throw new Error(`Invalid position ${position} for table with ${columns.length} columns`);
    }

    // Update table metadata
    const newColumns = [...columns];
    newColumns.splice(insertPos, 0, header);

    const containerCell = this.model.getCell(tableId);
    const cellData = containerCell.data ? JSON.parse(containerCell.data) : {};
    cellData.table.columns = newColumns;
    containerCell.data = JSON.stringify(cellData);

    // Create new header cell
    this.addNode({
      id: `${tableId}_header_c${insertPos}`,
      title: header,
      kind: 'Rectangle',
      parent: tableId,
      x: insertPos * cellWidth,
      y: 0,
      width: cellWidth,
      height: cellHeight
    });

    // Create new data cells for each row
    for (let row = 0; row < rows.length; row++) {
      this.addNode({
        id: `${tableId}_r${row}_c${insertPos}`,
        title: defaultValue,
        kind: 'Rectangle',
        parent: tableId,
        x: insertPos * cellWidth,
        y: (row + 1) * cellHeight,
        width: cellWidth,
        height: cellHeight
      });
    }

    // Shift cells after insertion point to the right
    for (let col = insertPos + 1; col <= columns.length; col++) {
      // Update header
      const headerCell = this.model.getCell(`${tableId}_header_c${col - 1}`);
      if (headerCell) {
        const geom = headerCell.getGeometry();
        headerCell.setGeometry(new mxGeometry(col * cellWidth, geom.y, geom.width, geom.height));
      }

      // Update data cells
      for (let row = 0; row < rows.length; row++) {
        const dataCell = this.model.getCell(`${tableId}_r${row}_c${col - 1}`);
        if (dataCell) {
          const geom = dataCell.getGeometry();
          dataCell.setGeometry(new mxGeometry(col * cellWidth, geom.y, geom.width, geom.height));
        }
      }
    }

    // Update container width
    const containerGeom = containerCell.getGeometry();
    containerCell.setGeometry(new mxGeometry(
      containerGeom.x,
      containerGeom.y,
      newColumns.length * cellWidth,
      containerGeom.height
    ));

    return this;
  }

  /**
   * Rename a table column
   */
  renameTableColumn({ tableId, oldHeader, newHeader }) {
    const tableInfo = this.getTableInfo(tableId);
    const { columns } = tableInfo;

    const colIndex = columns.indexOf(oldHeader);
    if (colIndex === -1) {
      throw new Error(`Column '${oldHeader}' not found in table '${tableId}'`);
    }

    // Update table metadata
    const containerCell = this.model.getCell(tableId);
    const cellData = containerCell.data ? JSON.parse(containerCell.data) : {};
    cellData.table.columns[colIndex] = newHeader;
    containerCell.data = JSON.stringify(cellData);

    // Update header cell value
    const headerCell = this.model.getCell(`${tableId}_header_c${colIndex}`);
    if (headerCell) {
      headerCell.setValue(newHeader);
    }

    return this;
  }

  /**
   * Update a single cell in a table
   */
  updateTableCell({ tableId, row, column, value }) {
    const tableInfo = this.getTableInfo(tableId);
    const { columns, rows } = tableInfo;

    // Resolve column index
    let colIndex: number;
    if (typeof column === 'string') {
      colIndex = columns.indexOf(column);
      if (colIndex === -1) {
        throw new Error(`Column '${column}' not found in table '${tableId}'`);
      }
    } else {
      colIndex = column;
    }

    // Validate row index
    if (row < 0 || row >= rows.length) {
      throw new Error(`Row index ${row} out of range (0-${rows.length - 1})`);
    }

    // Update cell
    const cellId = `${tableId}_r${row}_c${colIndex}`;
    this.editNode({ id: cellId, title: value });

    return this;
  }

  /**
   * Add a row to a table
   */
  addTableRow({ tableId, values, position = -1 }) {
    const tableInfo = this.getTableInfo(tableId);
    const { columns, cellWidth, cellHeight, rows } = tableInfo;

    if (values.length !== columns.length) {
      throw new Error(`Row must have ${columns.length} values, got ${values.length}`);
    }

    // Determine insert position
    const insertPos = position === -1 ? rows.length : position;
    if (insertPos < 0 || insertPos > rows.length) {
      throw new Error(`Invalid position ${position} for table with ${rows.length} rows`);
    }

    // If inserting in middle, shift existing rows down
    if (insertPos < rows.length) {
      for (let row = rows.length - 1; row >= insertPos; row--) {
        for (let col = 0; col < columns.length; col++) {
          const oldCellId = `${tableId}_r${row}_c${col}`;
          const newCellId = `${tableId}_r${row + 1}_c${col}`;
          const cell = this.model.getCell(oldCellId);
          if (cell) {
            cell.setId(newCellId);
            const geom = cell.getGeometry();
            cell.setGeometry(new mxGeometry(geom.x, (row + 2) * cellHeight, geom.width, geom.height));
          }
        }
      }
    }

    // Create new row cells
    for (let col = 0; col < columns.length; col++) {
      this.addNode({
        id: `${tableId}_r${insertPos}_c${col}`,
        title: values[col] || '',
        kind: 'Rectangle',
        parent: tableId,
        x: col * cellWidth,
        y: (insertPos + 1) * cellHeight,
        width: cellWidth,
        height: cellHeight
      });
    }

    // Update container height
    const containerCell = this.model.getCell(tableId);
    const containerGeom = containerCell.getGeometry();
    containerCell.setGeometry(new mxGeometry(
      containerGeom.x,
      containerGeom.y,
      containerGeom.width,
      (rows.length + 2) * cellHeight
    ));

    return this;
  }

  /**
   * Remove a column from a table
   */
  removeTableColumn({ tableId, column }) {
    const tableInfo = this.getTableInfo(tableId);
    const { columns, cellWidth, rows } = tableInfo;

    // Resolve column index
    let colIndex: number;
    if (typeof column === 'string') {
      colIndex = columns.indexOf(column);
      if (colIndex === -1) {
        throw new Error(`Column '${column}' not found in table '${tableId}'`);
      }
    } else {
      colIndex = column;
    }

    if (columns.length === 1) {
      throw new Error('Cannot remove the last column from a table');
    }

    // Remove header cell
    const headerCellId = `${tableId}_header_c${colIndex}`;
    this.removeNodes([headerCellId]);

    // Remove data cells
    const cellsToRemove: string[] = [];
    for (let row = 0; row < rows.length; row++) {
      cellsToRemove.push(`${tableId}_r${row}_c${colIndex}`);
    }
    this.removeNodes(cellsToRemove);

    // Shift cells after removed column to the left
    for (let col = colIndex + 1; col < columns.length; col++) {
      // Rename and reposition header
      const oldHeaderId = `${tableId}_header_c${col}`;
      const newHeaderId = `${tableId}_header_c${col - 1}`;
      const headerCell = this.model.getCell(oldHeaderId);
      if (headerCell) {
        headerCell.setId(newHeaderId);
        const geom = headerCell.getGeometry();
        headerCell.setGeometry(new mxGeometry((col - 1) * cellWidth, geom.y, geom.width, geom.height));
      }

      // Rename and reposition data cells
      for (let row = 0; row < rows.length; row++) {
        const oldCellId = `${tableId}_r${row}_c${col}`;
        const newCellId = `${tableId}_r${row}_c${col - 1}`;
        const dataCell = this.model.getCell(oldCellId);
        if (dataCell) {
          dataCell.setId(newCellId);
          const geom = dataCell.getGeometry();
          dataCell.setGeometry(new mxGeometry((col - 1) * cellWidth, geom.y, geom.width, geom.height));
        }
      }
    }

    // Update table metadata
    const containerCell = this.model.getCell(tableId);
    const cellData = containerCell.data ? JSON.parse(containerCell.data) : {};
    cellData.table.columns.splice(colIndex, 1);
    containerCell.data = JSON.stringify(cellData);

    // Update container width
    const containerGeom = containerCell.getGeometry();
    containerCell.setGeometry(new mxGeometry(
      containerGeom.x,
      containerGeom.y,
      (columns.length - 1) * cellWidth,
      containerGeom.height
    ));

    return this;
  }

  /**
   * Remove a row from a table
   */
  removeTableRow({ tableId, row }) {
    const tableInfo = this.getTableInfo(tableId);
    const { columns, cellHeight, rows } = tableInfo;

    if (row < 0 || row >= rows.length) {
      throw new Error(`Row index ${row} out of range (0-${rows.length - 1})`);
    }

    // Remove cells in this row
    const cellsToRemove: string[] = [];
    for (let col = 0; col < columns.length; col++) {
      cellsToRemove.push(`${tableId}_r${row}_c${col}`);
    }
    this.removeNodes(cellsToRemove);

    // Shift subsequent rows up
    for (let r = row + 1; r < rows.length; r++) {
      for (let col = 0; col < columns.length; col++) {
        const oldCellId = `${tableId}_r${r}_c${col}`;
        const newCellId = `${tableId}_r${r - 1}_c${col}`;
        const cell = this.model.getCell(oldCellId);
        if (cell) {
          cell.setId(newCellId);
          const geom = cell.getGeometry();
          cell.setGeometry(new mxGeometry(geom.x, r * cellHeight, geom.width, geom.height));
        }
      }
    }

    // Update container height
    const containerCell = this.model.getCell(tableId);
    const containerGeom = containerCell.getGeometry();
    containerCell.setGeometry(new mxGeometry(
      containerGeom.x,
      containerGeom.y,
      containerGeom.width,
      rows.length * cellHeight
    ));

    return this;
  }

  /**
   * Create a link from a node to a specific table cell
   */
  linkToTableCell({ from, tableId, row, column, title, style = {}, undirected }) {
    const tableInfo = this.getTableInfo(tableId);
    const { columns, rows } = tableInfo;

    // Resolve column index
    let colIndex: number;
    if (typeof column === 'string') {
      colIndex = columns.indexOf(column);
      if (colIndex === -1) {
        throw new Error(`Column '${column}' not found in table '${tableId}'`);
      }
    } else {
      colIndex = column;
    }

    // Validate row index
    if (row < 0 || row >= rows.length) {
      throw new Error(`Row index ${row} out of range (0-${rows.length - 1})`);
    }

    // Construct cell ID
    const cellId = `${tableId}_r${row}_c${colIndex}`;

    // Validate cell exists
    const cell = this.model.getCell(cellId);
    if (!cell) {
      throw new Error(`Cell at row ${row}, column ${colIndex} not found in table '${tableId}'`);
    }

    // Create link
    return this.linkNodes({ from, to: cellId, title, style, undirected });
  }

  /**
   * Copy a table to a new location, optionally renaming it
   * @param tableId - Source table ID
   * @param newId - New table ID
   * @param x - X coordinate for new table
   * @param y - Y coordinate for new table
   * @param newTitle - Optional new title for the table container
   * @returns New table info
   */
  copyTable({ tableId, newId, x, y, newTitle }: any) {
    const sourceTableInfo = this.getTableInfo(tableId);
    const sourceContainer = this.model.getCell(tableId);

    if (!sourceContainer) {
      throw new Error(`Table '${tableId}' not found`);
    }

    // Get container title and custom data
    const containerTitle = newTitle !== undefined ? newTitle : (sourceContainer.getValue() || '');
    const containerData = sourceContainer.data ? JSON.parse(sourceContainer.data) : {};
    const customData = { ...containerData };
    delete customData.table; // Remove table metadata, will be recreated

    // Create new table with same structure
    const newTableInfo = this.addTable({
      id: newId,
      x: Number(x),
      y: Number(y),
      headers: sourceTableInfo.columns,
      rows: sourceTableInfo.rows,
      cellWidth: sourceTableInfo.cellWidth,
      cellHeight: sourceTableInfo.cellHeight,
      data: customData
    });

    // Update container title if provided
    if (containerTitle) {
      const newContainer = this.model.getCell(newId);
      if (newContainer) {
        newContainer.setValue(containerTitle);
      }
    }

    return newTableInfo;
  }

  /**
   * Find tables matching filter criteria
   */
  findTables({ filters = {} }: { filters?: any } = {}) {
    const allNodes = this.getAllNodes();
    const tables: any[] = [];

    for (const node of allNodes) {
      // Check if node is a table
      if (!node.data || !node.data.table || node.data.table.type !== 'table') {
        continue;
      }

      // Get full table info
      try {
        const tableInfo = this.getTableInfo(node.id);

        // Apply filters
        if (filters.id && tableInfo.id !== filters.id) continue;
        if (filters.id_contains && !tableInfo.id.includes(filters.id_contains)) continue;

        // Filter by table title/label
        if (filters.title && node.title !== filters.title) continue;
        if (filters.title_contains) {
          const titleLower = (node.title || '').toLowerCase();
          const searchLower = filters.title_contains.toLowerCase();
          if (!titleLower.includes(searchLower)) continue;
        }

        // Filter by custom data properties on table container
        if (filters.data) {
          const containerData = node.data || {};
          let dataMatches = true;
          for (const key in filters.data) {
            // Skip the 'table' property which is internal metadata
            if (key === 'table') continue;
            if (containerData[key] !== filters.data[key]) {
              dataMatches = false;
              break;
            }
          }
          if (!dataMatches) continue;
        }

        if (filters.has_column && !tableInfo.columns.includes(filters.has_column)) continue;
        if (filters.row_count_min !== undefined && tableInfo.rows.length < filters.row_count_min) continue;
        if (filters.row_count_max !== undefined && tableInfo.rows.length > filters.row_count_max) continue;

        // Include title and custom data in results
        const result = {
          ...tableInfo,
          title: node.title || '',
          data: { ...node.data }
        };
        delete result.data.table; // Remove internal metadata from results

        tables.push(result);
      } catch (e) {
        // Skip invalid tables
        continue;
      }
    }

    return tables;
  }

  toXML() {
    const encoder = new mxCodec();
    const result = encoder.encode(this.model);
    return mxUtils.getPrettyXml(result)
  }

  /**
   * Static method to create a Graph instance from XML
   * @param {string} xmlString - XML string in mxGraph format
   * @returns {Graph} - New Graph instance loaded from XML
   */
  static fromXML(xmlString) {
    const graph = new Graph();

    // Use the global DOMParser that was set up in mxgraph.js
    const parsedDoc = new DOMParser().parseFromString(xmlString, 'text/xml')

    // Create a codec with the parsed document
    const codec = new mxCodec(parsedDoc);
    
    codec.decode(parsedDoc.documentElement, graph.model);

    return graph;
  }
}

/**
 * Computes the effective line style for an edge in the graph, merging the provided style
 * with default base styles. If the edge is undirected, disables arrowheads and reverses.
 *
 * @param {Record<string, any>} style - Optional style overrides for the edge.
 * @param {boolean} [undirected] - If true, creates an undirected edge (no arrows).
 * @returns {Record<string, any>} The computed style object for the edge.
 */
function computeEffectiveLineStyle(style: Record<string, any> = {}, undirected?: boolean): Record<string, any> {
  const base = { edgeStyle: 'none', noEdgeStyle: 1, orthogonal: 1, html: 1 }
  const effective: Record<string, any> = { ...base, ...style }
  if (undirected) {
    effective.reverse = undefined
    effective.startArrow = 'none'
    effective.endArrow = 'none'
  }
  return effective
}
