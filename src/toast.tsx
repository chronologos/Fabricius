// @ts-nocheck
import ReactDOM from 'react-dom';
import React from 'react';
import {Intent, Position, Toast, Toaster} from '@blueprintjs/core';

export const render = ({
  id,
  content,
  intent,
}: {
  id: string;
  content: string;
  intent: Intent;
}): void => {
  const parent = getRenderRoot(id);
  ReactDOM.render(
    <div>
      <Toaster position={Position.TOP} canEscapeKeyClear>
        <Toast
          intent={intent}
          message={content}
          timeout={3000}
          onDismiss={() => {
            ReactDOM.unmountComponentAtNode(parent);
            parent.remove();
          }}
        />
      </Toaster>
    </div>,
    parent
  );
};

export const getRenderRoot = (id: string): HTMLDivElement => {
  const app = document.getElementsByClassName('roam-body-main').item(0); // TODO?
  const newRoot = document.createElement('div');
  newRoot.id = `roamjs-${id}-root`;
  app!.prepend(newRoot);
  return newRoot;
};
