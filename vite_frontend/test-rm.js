import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

const result = renderToString(
  React.createElement(ReactMarkdown, {
    components: {
      text: (props) => React.createElement('mark', null, props.children),
      p: (props) => React.createElement('p', null, props.children)
    }
  }, "Hello world")
);

console.log("RENDERED:", result);
