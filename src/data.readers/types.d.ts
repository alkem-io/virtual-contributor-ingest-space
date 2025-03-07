export declare type Profile = {
  displayName: string;
  url: string;
};
export declare type BodyOfKnowledgeReadResult = {
  profile?: Profile;
  about?: { profile: Profile };
  id: string;
};

export declare type ReadResult = {
  documents?: Document[];
  bodyOfKnowledge?: BodyOfKnowledgeReadResult;
};
