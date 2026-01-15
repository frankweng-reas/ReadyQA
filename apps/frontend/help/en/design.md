# Design Feature Guide

## Overview

The Design feature allows you to fully customize your Chatbot's appearance and behavior, including styling for the header, chat area, input box, and other sections. All settings are automatically saved, and the preview area on the left displays your changes in real-time.

## Feature Sections

### 1. Header Settings

The header is the top area of the Chatbot. You can configure the following:

#### Basic Settings
- **Show Header**: Toggle to show or hide the header
- **Title Text**: Set the main title of the Chatbot (e.g., "AI Assistant")
- **Subtitle**: Set the subtitle text (optional, e.g., "Fast and accurate answers")
- **Logo**: Upload a custom logo image
  - Supported formats: JPG, PNG, GIF, WEBP
  - File size limit: Maximum 5MB

#### Layout Settings
- **Alignment**: Choose the alignment of the title and logo
  - Left: Align title and logo to the left
  - Center: Center align title and logo
  - Right: Align title and logo to the right
- **Size**: Adjust the header height and text size
  - Small: Smaller header
  - Medium: Medium-sized header
  - Large: Larger header

#### Color Settings
- **Background Color**: Set the header background color
  - **Solid Color Mode**: Choose a single color as background
  - **Gradient Mode**: Use a gradient background
    - Start Color: The starting color of the gradient
    - End Color: The ending color of the gradient
    - Gradient Direction: Choose the gradient direction (right, bottom, left, top, bottom-right, bottom-left, top-right, top-left)
- **Text Color**: Set the text color for title and subtitle

---

### 2. Chat Area Settings

The chat area is the main content area in the middle of the Chatbot, containing user messages and Q&A cards.

#### Chat Background
- **Chat Background Color**: Set the background color for the entire chat area

#### User Message Settings
- **Bubble Color**: Set the background color of user message bubbles
- **Text Color**: Set the text color of user messages

#### Q&A Card Settings

Q&A cards are the main components displaying FAQ questions and answers. You can configure detailed styling:

**Appearance Settings**
- **Background Color**: The background color of Q&A cards
- **Border Color**: The border color of Q&A cards
- **Border Radius**: Choose the border radius size (small, medium, large)
- **Padding**: Choose the padding size (small, medium, large)
- **Shadow Effect**: Choose the shadow intensity (none, small, medium, large)

**Text Settings**
- **Question Text Color**: The color of question titles in Q&A cards
- **Question Text Size**: The font size of question titles (18px - 32px)
- **Answer Text Color**: The color of answer content in Q&A cards
- **Answer Text Size**: The font size of answer content (12px - 20px)

**Border Settings**
- **Accent Color**: The accent color of the left border of Q&A cards
- **Separator Height**: The height of the separator between questions and answers (1px - 16px)
- **Separator Color**: The color of the separator between questions and answers

---

### 3. Input Box Settings

The input box is where users enter questions. You can configure position, styling, and buttons.

#### Position Settings
- **Input Position**: Choose the position of the input box
  - Top: Input box appears at the top of the Chatbot
  - Bottom: Input box appears at the bottom of the Chatbot (default)

#### Feature Settings
- **Enable Voice Input**: Toggle to enable or disable voice input functionality

#### Color Settings
- **Input Area Background Color**: The background color of the area around the input box
- **Input Background Color**: The background color of the input box itself
- **Input Border Color**: The border color of the input box
- **Input Text Color**: The color of user input text
- **Placeholder Text Color**: The color of placeholder text in the input box

#### Text Settings
- **Placeholder Text**: Set the placeholder text for the input box (e.g., "Enter your question...")

#### Send Button Settings
- **Send Button Background Color**: The background color of the send button
- **Send Button Text Color**: The icon color of the send button
- **Send Button Hover Color**: The button color when hovering
- **Send Button Icon**: Choose the icon style for the send button
  - Right Arrow (→)
  - Paper Plane (✈)
  - Up Arrow (↑)
  - Send Icon (📤)
  - Right Chevron (▶)

---

### 4. Advanced Settings

Advanced settings include container styling, query mode, and contact information settings.

#### Container Style Settings

Container style controls the appearance of the Chatbot's outer frame:

- **Border Radius**: Choose the border radius size of the container frame
  - None: No border radius
  - Small: Small border radius
  - Medium: Medium border radius
  - Large: Large border radius
  - Extra Large: Extra large border radius
  - Super Large: Super large border radius
- **Shadow**: Choose the shadow effect of the container frame
  - None: No shadow
  - Small: Small shadow
  - Medium: Medium shadow
  - Large: Large shadow
  - Extra Large: Extra large shadow
  - Super Large: Super large shadow
- **Border**: Choose the border width of the container frame
  - None: No border
  - Small: Thin border
  - Medium: Medium border
  - Large: Thick border
- **Border Color**: If a border is set, you can set the border color

#### Query Mode Settings

Configure the query modes provided by the Chatbot:

- **Both Modes**: Provide both AI Chat and Browse QA modes simultaneously
  - AI Chat: Users can input questions, and AI will automatically answer
  - Browse QA: Users can browse the FAQ Q&A list
- **AI Chat Only**: Only provide AI Chat mode, hide Browse QA
- **Browse QA Only**: Only provide Browse QA mode, hide AI Chat

#### Contact Information Settings

Configure whether to display contact information in the Chatbot:

- **Enable Contact Info**: Toggle to enable or disable contact information functionality
- **Name**: Contact person's name (e.g., "Customer Service")
- **Phone**: Contact phone number
- **Email**: Contact email address

---

## Preview Feature

The preview area on the left displays your setting changes in real-time, allowing you to see the effects while adjusting settings.

### Preview Feature Description
- **Real-time Preview**: All setting changes are immediately reflected in the preview area
- **Background Toggle**: You can toggle the preview background between white and black to test display effects under different backgrounds
- **Full-screen Preview**: Click the "Open Preview" button to open a full-screen preview window

---

## Usage Tips

### Setting Recommendations
1. **Set Main Colors First**: It's recommended to adjust the main colors of the header, chat area, and input box first to establish the overall color scheme
2. **Fine-tune Details**: After setting the main colors, adjust details like text size, border radius, shadows, etc.
3. **Test Different Backgrounds**: Use the background toggle feature to test display effects under different backgrounds
4. **Check Contrast**: Ensure sufficient contrast between text and background colors for readability

### Auto-save
- All settings are automatically saved; no need to manually click a save button
- Settings are automatically saved to the database approximately 1 second after changes

### Reset Function
- You can use the "Reset" button in the top right to restore all settings to default values
- A confirmation dialog will appear before resetting to prevent accidental operations

---

## Frequently Asked Questions

### Q: Why aren't my settings taking effect immediately?
A: Settings are automatically saved, but you may need to refresh the page or reload the Chatbot widget to see changes.

### Q: How large can my logo be?
A: Logo file size is limited to 5MB, supporting JPG, PNG, GIF, WEBP formats.

### Q: How can I make the Chatbot show only Browse QA, not AI Chat?
A: In "Advanced Settings" → "Query Mode Settings", select "Browse QA Only".

### Q: Will settings affect published Chatbots?
A: Yes, settings are immediately applied to published Chatbots. It's recommended to verify settings in a test environment first.

---

## Technical Notes

- All color settings support hexadecimal color codes (e.g., #FFFFFF) and CSS color names
- Styles like border radius, shadows, and borders use Tailwind CSS class names
- Setting data is stored in the database and bound to the Chatbot
- Default themes can be adjusted in system settings
