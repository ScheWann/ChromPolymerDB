import React, { useState, useEffect } from 'react';
import { Drawer } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import "./Styles/TutorialDrawer.css";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

export const TutorialDrawer = ({ visible, onClose }) => {
    const [content, setContent] = useState('');

    useEffect(() => {
        if (visible) {
            fetch('/tutorial.md')
                .then(res => res.text())
                .then(text => setContent(text))
                .catch(err => {
                    console.error('load Markdown failed:', err);
                    setContent('*Error loading tutorial.*');
                });
        }
    }, [visible]);

    return (
        <Drawer
            size="large"
            width="100%"
            title="Tutorial"
            closable={{ 'aria-label': 'Close Button' }}
            onClose={onClose}
            open={visible}
        >   
            <div className="tutorial-drawer-content">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    skipHtml={false}
                    components={{
                        img: ({ node, src, alt, title, ...props }) => {
                            if (alt === 'small') {
                                return <img src={src} alt={alt} title={title} {...props} />;
                            }
                            if (alt === 'medium') {
                                return (
                                    <img
                                        src={src}
                                        alt={alt}
                                        title={title}
                                        {...props}
                                        style={{
                                            display: 'block',
                                            width: '20%',
                                            margin: '0 auto',
                                        }}
                                    />
                                );
                            }
                            if (alt === 'large') {
                                return (
                                    <img
                                        src={src}
                                        alt={alt}
                                        title={title}
                                        {...props}
                                        style={{
                                            display: 'block',
                                            width: '50%',
                                            margin: '0 auto',
                                        }}
                                    />
                                );
                            }
                            if (alt === 'large-pro') {
                                return (
                                    <img
                                        src={src}
                                        alt={alt}
                                        title={title}
                                        {...props}
                                        style={{
                                            display: 'block',
                                            width: '60%',
                                            margin: '0 auto',
                                        }}
                                    />
                                );
                            }
                            return (
                                <img
                                    src={src}
                                    alt={alt}
                                    title={title}
                                    {...props}
                                    style={{
                                        display: 'block',
                                        margin: '16px auto',
                                        width: '90%',
                                    }}
                                />
                            );
                        },
                        p: ({ node, children, ...props }) => (
                            <p
                                {...props}
                                style={{
                                    fontSize: '16px',
                                    lineHeight: 1.5,
                                }}
                            >
                                {children}
                            </p>
                        ),
                        ul: ({ node, children, ...props }) => (
                            <ul
                                {...props}
                                style={{
                                    fontSize: '16px',
                                    lineHeight: 1.5,
                                }}
                            >
                                {children}
                            </ul>
                        ),
                        ol: ({ node, children, ...props }) => (
                            <ol
                                {...props}
                                style={{
                                    fontSize: '16px',
                                    lineHeight: 1.5,
                                }}
                            >
                                {children}
                            </ol>
                        ),
                        h1: ({ node, children, ...props }) => (
                            <h1
                                {...props}
                                style={{
                                    borderBottom: '2px solid #F0F0F0',
                                    paddingBottom: '8px',
                                    paddingTop: '30px',
                                    marginTop: 0,
                                }}
                            >
                                {children}
                            </h1>
                        ),
                        h2: ({ node, children, ...props }) => (
                            <h2
                                {...props}
                                style={{
                                    borderBottom: '2px solid #F0F0F0',
                                    paddingBottom: '8px',
                                    marginTop: '20px',
                                }}
                            >
                                {children}
                            </h2>
                        ),
                    }}>
                    {content}
                </ReactMarkdown>
            </div>
        </Drawer>
    );
}