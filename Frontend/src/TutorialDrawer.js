import React, { useState, useEffect } from 'react';
import { Drawer } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
            title="Tutorial"
            closable={{ 'aria-label': 'Close Button' }}
            onClose={onClose}
            open={visible}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
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
                                        width: '40%',
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
                                        width: '600px',
                                        maxWidth: '100%',
                                    }}
                                />
                            );
                    }
                }}>
                {content}
            </ReactMarkdown>
        </Drawer>
    );
}