# Knowledge Management Feature Guide

## Overview

The Knowledge Management feature allows you to manage your Chatbot's knowledge base, including creating, editing, categorizing, and bulk uploading Q&A content. The system provides three main functional areas: Q&A List, Category Management, and Bulk Upload.

## Feature Sections

### 1. Q&A List

The Q&A List is the main area for managing all Q&A content, providing complete CRUD functionality.

#### Basic Operations

- **Create Q&A**: Click the "+ Add New" button in the top right to open the Q&A editor
- **Edit Q&A**: Click the "Edit" button on the right side of a Q&A item
- **Delete Q&A**: Click the "Delete" button on the right side of a Q&A item; the system will ask for confirmation
- **View Details**: Click on a Q&A item to view its full content

#### Search and Filter

- **Search Function**: Enter keywords in the search box to search question or answer content
- **Category Filter**: Use the category dropdown to select a specific category or "Uncategorized"
- **Status Filter**: Use the statistics buttons to quickly filter:
  - **Total**: Show all Q&A items
  - **Active**: Show only active Q&A items
  - **Inactive**: Show only inactive Q&A items
  - **Uncategorized**: Show only uncategorized Q&A items

#### Batch Operations

After selecting multiple Q&A items, you can perform batch operations:

- **Batch Set Category**: Set category for selected Q&A items
- **Batch Activate**: Set selected Q&A items to active status
- **Batch Deactivate**: Set selected Q&A items to inactive status
- **Batch Delete**: Delete all selected Q&A items

**How to Use:**
1. Check the checkbox on the left side of Q&A items
2. After selecting multiple items, a batch operation toolbar will appear at the top
3. Select the operation to perform
4. The system will ask for confirmation before executing

#### Q&A Editor

The Q&A Editor supports the following fields:

**Required Fields**
- **Question**: The question title of the Q&A
- **Answer**: The answer content (supports Markdown format)

**Optional Fields**
- **Synonyms**: Enter multiple synonyms separated by commas (e.g., FAQ, Q&A, Questions and Answers)
- **Category**: Select the category for the Q&A
- **Status**: Set the Q&A to "Active" or "Inactive"

**Markdown Support**
- The answer field supports Markdown format
- You can use headings, lists, bold, italic, links, etc.
- Supports image upload (JPG, PNG, GIF, WEBP, max 5MB)

---

### 2. Category Management

Category Management allows you to create a hierarchical category structure to organize and manage Q&A content.

#### Basic Operations

- **Create Category**: Click the "+ Create Category" button in the top right
- **Edit Category**: Click the "Edit" button on the right side of a category item
- **Delete Category**: Click the "Delete" button on the right side of a category item
  - If the category contains Q&A items, the system will prompt that it cannot be deleted
  - If the category has subcategories, you need to delete subcategories first

#### Hierarchical Structure

- **Parent Category**: You can create top-level categories
- **Subcategory**: You can create subcategories for categories, forming a multi-level hierarchical structure
- **Expand/Collapse**: Click on a category item to expand or collapse subcategories

#### Sorting Function

- **Move Up/Down**: Use the up/down arrow buttons on the right side of category items to adjust order
- Sorting affects the display order of categories in the Q&A list

#### Category Form

When creating or editing a category, you can set:

- **Category Name**: Required, the display name of the category
- **Parent Category**: Select the parent category for this category (optional)
- **Description**: Description text for the category (optional)

---

### 3. Bulk Upload

The Bulk Upload feature allows you to import multiple Q&A items at once through CSV or XLSX files.

#### Supported Formats

- **CSV**: Comma-separated values file
- **XLSX**: Excel 2007+ format

#### Usage Steps

1. **Select File**
   - Click "Browse Files" or drag and drop a file to the upload area
   - The system will automatically parse the file content

2. **Field Mapping**
   - The system will automatically detect field names
   - Manually map fields to system fields:
     - **Question** (required): Map to question field
     - **Answer** (required): Map to answer field
     - **Synonyms** (optional): Map to synonyms field
     - **Category Name** (optional): Map to category field
   - Unneeded fields can be set to "Ignore this field"

3. **Data Preview**
   - Check if the parsed data is correct
   - View validation errors (if any)
   - Fix errors and re-upload

4. **Execute Upload**
   - Click the "Upload" button to start bulk upload
   - The system will display upload progress and results

#### Field Mapping Rules

The system automatically recognizes the following field names (case-insensitive):

**Question Field**
- question, 問題, 問, q, q:

**Answer Field**
- answer, 答案, 回答, ans, a, a:, 答案：, 回答：

**Synonyms Field**
- synonym, 同義詞, 別名, 同義問法, synonyms, 別名：, 同義詞：, 標籤, tag, tags, 標籤：

**Category Field**
- topic_name, topic, 分類, category, 類別

#### Data Validation

Before upload, the system performs the following validations:

- **Required Field Check**: Question and answer must be filled
- **Data Format Check**: Ensure data format is correct
- **Category Check**: If a category name is specified, the system will automatically create non-existent categories

#### Upload Results

After upload completion, the following will be displayed:

- **Success Count**: Number of successfully added Q&A items
- **Skipped Count**: Number of items skipped due to duplicates or other reasons
- **Failed Count**: Number of failed Q&A items
- **Details**: You can view the upload status of each Q&A item

---

## Usage Tips

### Q&A Management

1. **Use Categories to Organize Q&A**: It's recommended to first create a category structure, then categorize Q&A items accordingly
2. **Make Good Use of Synonyms**: Setting synonyms for Q&A items can improve AI search accuracy
3. **Regularly Check Inactive Q&A**: Deactivate outdated or incorrect Q&A items to avoid misleading users
4. **Use Markdown to Format Answers**: Make answer content more readable with support for images and links

### Category Management

1. **Create Hierarchical Structure**: Use parent-child categories to create a clear knowledge structure
2. **Name Appropriately**: Use clear and concise category names
3. **Regular Organization**: Delete unnecessary categories to keep the category structure clean

### Bulk Upload

1. **Prepare Data**: Ensure CSV/XLSX file format is correct and field names are clear
2. **Preview Before Upload**: Check data preview before uploading to confirm field mapping is correct
3. **Upload in Batches**: If data volume is large, it's recommended to upload in batches to avoid uploading too much data at once
4. **Check Results**: After upload, check failed items and re-upload after fixing

---

## Frequently Asked Questions

### Q: How do I delete a category that contains Q&A items?
A: You need to first move Q&A items under the category to other categories or set them as uncategorized before you can delete the category.

### Q: What happens if a category doesn't exist during bulk upload?
A: The system will automatically create non-existent categories. If a category name maps to multiple fields, it will use the value from the first mapped field.

### Q: What is the "Hit Count" for Q&A items?
A: Hit count records how many times the Q&A item has been queried by users, which can help you understand which Q&A items are most frequently used.

### Q: What image formats are supported?
A: JPG, JPEG, PNG, GIF, WEBP formats are supported, with a maximum file size of 5MB per file.

### Q: How do I make Q&A items appear in the Chatbot?
A: Q&A items must be set to "Active" status to appear in the Chatbot. Inactive Q&A items will not appear in search results.

### Q: What should I do if bulk upload fails?
A: Check the error messages in the upload results, fix the data, and re-upload. Common errors include:
- Missing required fields
- Incorrect data format
- Unsupported file format

---

## Technical Notes

- Q&A data is stored in the database and bound to the Chatbot
- Supports Markdown format for answer content
- Uploaded images are stored on the server and URLs are generated
- Bulk upload uses batch processing to improve upload efficiency
- Categories support unlimited hierarchical structure
