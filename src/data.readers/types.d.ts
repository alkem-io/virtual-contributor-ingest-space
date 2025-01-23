export declare type BodyOfKnowledgeReadResult = {
  id: string;
  profile: { displayName: string; url: string };
};

export declare type ReadResult = {
  documents?: Document[];
  bodyOfKnowledge?: BodyOfKnowledgeReadResult;
};
