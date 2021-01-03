// **** Settings for the Autocar plug-in ****

// Choose the 'waiting' tag to apply to the new actions.
// Enter its OmniFocus ID (get it using 'Copy as Link').
const waitTagID = ''
// Alternatively, look up the tag from its name (the nearest match will be used if there is no exact match).
const waitTagName = 'waiting'

// Apply the specified 'waiting' tag to the new actions (true/false).
const applyWaitTag = true
// Place the 'waiting' tag before any other tags.
const placeWaitTagFirst = false

// Apply the tags of each completed action to its corresponding 'waiting for' action (true/false).
const reapplyTags = false
// Only reapply the following tags and their descendants.
// Enter [] to reapply all tags, or a list of tag IDs or names, example: ['People', 'Important', 'g8LToQ3AQpK'].
const reappliedTagsFilter = []

// List (array) of rules to create the name of each 'waiting for' action based on its corresponding completed action,
// in decreasing order of priority. Each rule can be a prefix text or an array with 2 items:
// a regular expression literal for pattern matching and a string for the replacement text.
const taskNameRules = [
    [ /.*?(?:ask|call|email|message)\s(?:to\s)?(.+?)(?:\s+(?:to|for|about|regarding|re)\W+|—|\W{2,})(.+)/i , 'Waiting for reply from $1: $2' ],
    [ /.*?(?:ask|call|email|message)\W+(.+)/i , 'Waiting for reply: $1'],
    [ /.*?(?:order)(?:\s(?:of|for))?\W+(.+)/i , 'Waiting for delivery: $1'],
    'Waiting for response: ',
    'Waiting for: '
]

// In the note of the 'waiting for' action, add a link to the completed action (true, false, or the text to add before the link).
const noteLink = 'Created on completion of:'

// Set a defer date for the 'waiting for' action when the 'Complete and Await Response' command runs automatically (true/false).
const setDeferDate = false
// Preselect a default defer date in the Options dialog (true/false).
const setDeferDateInDialog = true
// Number of days from now for the defer date.
const deferDaysLater = 5
                                
// Set a due date for the 'waiting for' action when the 'Complete and Await Response' command runs automatically (true/false).
const setDueDate = false
// Preselect a default due date in the Options dialog (true/false).
const setDueDateInDialog = true
// Number of days from now for the due date.
const dueDaysLater = 7

// Show the Options dialog when running on macOS (true/false).
const macShowDialog = false
// Show the Options dialog when running on iOS (true/false).
const iOSShowDialog = false

// ********