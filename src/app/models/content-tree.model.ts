export interface ContentNode {
  nodeId: number;
  nodeTitle: string;
  nodeTypeId: number;   // 1 = Unit, 2 = Chapter, 3 = Topic
  nodeTypeName: string;
  displayOrder: number;
  parentNodeId?: number;
  children: ContentNode[];
}

export interface ContentTree {
  facultyId: number;
  subjectId: number;
  sessionId: number;
  nodes: ContentNode[];
  totalNodes: number;
}
