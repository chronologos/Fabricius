import { Intent } from '@blueprintjs/core';
export declare const render: ({ id, content, intent, }: {
    id: string;
    content: string;
    intent: Intent;
}) => void;
export declare const getRenderRoot: (id: string) => HTMLDivElement;
