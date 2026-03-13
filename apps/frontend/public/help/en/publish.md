# Publish Feature Guide

## Overview

The Publish feature lets you share your Q&A assistant with users through different deployment methods. You can get the PWA URL, iframe embed code, Widget bubble code, and control access via domain whitelist.

## Publish Assistant

### PWA URL

- **Purpose**: Direct link to the full Chatbot page, suitable for sharing with users to open in a browser
- **Usage**: Click the "Copy URL" button to copy the URL to clipboard
- **QR Code**: Scan the QR Code with your phone to open the Chatbot in a browser, and optionally "Add to Home Screen" to install as a PWA app

### iframe Page Embed

- **Purpose**: Embed the Chatbot into your own webpage as part of the page
- **Usage**: Click the "Copy Code" button to copy the iframe code to clipboard, then paste it into your HTML page
- **Customization**: Adjust the `width` and `height` attributes to fit your layout

### Widget Floating Bubble

- **Purpose**: Display a floating bubble button in the bottom-right corner of your website; clicking it expands the Chatbot dialog
- **Usage**: Click the "Copy Code" button to copy the script tag, then paste it before `</body>` on your website
- **Parameters**: Customize position, size, bubble color, etc. via `data-*` attributes

## Access Control

### Domain Whitelist

When enabled, only domains in the whitelist can embed this Chatbot via iframe or Widget. Domains not in the whitelist will not be able to load the Chatbot.

### Domain Format

- **Full domain**: e.g., `example.com`
- **Subdomains**: e.g., `*.subdomain.com` matches `a.subdomain.com`, `b.subdomain.com`
- **Local testing**: e.g., `localhost` or `127.0.0.1`

### How to Use

1. Check "Enable Domain Whitelist"
2. Enter a domain in the input field and click "Add"
3. Click the delete button next to a domain to remove it
4. Changes are saved automatically

## Best Practices

1. **Testing**: Add `localhost` or your test domain during development
2. **Production**: Remember to add your production domain to the whitelist before launch
3. **Security**: If your Chatbot contains sensitive information, consider enabling the domain whitelist to restrict embedding sources
