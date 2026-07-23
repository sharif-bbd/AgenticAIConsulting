import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

const HighlightStrings = (children) => {
  return React.Children.map(children, child => {
    if (typeof child === 'string') {
      return React.createElement('mark', null, child);
    }
    if (React.isValidElement(child) && child.props && child.props.children) {
      return React.cloneElement(child, {
        ...child.props,
        children: HighlightStrings(child.props.children)
      });
    }
    return child;
  });
};

const CustomP = (props) => {
  return React.createElement('p', null, HighlightStrings(props.children));
};

const result = renderToString(
  React.createElement(ReactMarkdown, {
    components: {
      p: CustomP
    }
  }, "Hello **world**, you are cool")
);

console.log("RENDERED:", result);
