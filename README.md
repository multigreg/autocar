# Autocar
A ‘Complete and Await Response’ plug-in for OmniFocus, with automatic naming and tagging of new actions.
## About
The ‘Complete and Await Response’ command marks the currently selected actions as complete and creates corresponding actions to represent responses you are waiting for (for example, a reply to an email, or a delivery following an order).

Features include applying a filtered set of the tags of the completed actions to the new actions, and rules for automatically naming the new actions.

The ‘Complete and Await Response’ command can be run directly with default options, or with the ‘Option’ key pressed to display an Options dialog for the new actions.

[More details and examples](https://github.com/multigreg/autocar/wiki)
## Installation
This plug-in requires OmniFocus for macOS version 3.11.1 or later, or OmniFocus for iOS version 3.11.2 or later.
### 1. Download the plug-in.
Download the plug-in file (`autocar.omnifocusjs.zip`) of the latest release and unzip the file. [Go to releases](https://github.com/multigreg/autocar/releases)
### 2. (Optional) Specify a ‘waiting’ tag in the preferences.
By default, the plug-in looks for a tag called ‘waiting’ (or a close match) and adds it to the new actions. This tag will be created if it isn’t found.

To specify a different tag, edit the plug-in’s settings file: see [Preferences](README.md#Preferences). At the top of the file, specify either the ID of the tag (`waitTagID` preference)  or the name of the tag (`waitTagName` preference).

### 3. Add the plug-in to OmniFocus.
- On macOS, double-click on the plug-in file.
- On iOS, tap on the plug-in file in the Files app.

An OmniFocus dialog appears and includes an option for  which plug-ins folder to copy it to (either the local or iCloud plug-ins folder, or a linked folder previously added using the ’Automation’ menu).

### 4. (Optional) Add the icon to the toolbar in OmniFocus for macOS.
Select ‘Customize Toolbar’ in the ‘View’ menu and drag the ‘Complete and Await Response’ icon to the toolbar.
## How to use
1. In OmniFocus, select one or more actions to mark as complete.
2. Select ‘Complete and Await Response’:
   - On macOS, from the ‘Automation’ menu or the toolbar.
   - On iOS, from the share sheet. Long-press on an action and choose ‘Share’ from the context menu, or select several actions in ‘Edit’ mode and tap on the share icon.

**Use the ‘Option’ key to open the options dialog.**
To open a dialog with options for the new actions, hold down the ‘Option’ key when using the ‘Complete and Await Response’ command (due to a bug in OmniFocus for macOS at the time of writing, when using the menu it is necessary to hold down the ‘Option’ key _before_ clicking on ‘Automation’ in the menu bar).
## Preferences
Preferences, which control the behaviour of the plug-in and the default options for the new actions, can be changed in the `Autocar preferences.txt` file.

To modify the settings on macOS:
- right-click (or Control-click) on the plug-in file (`autocar.omnifocusjs`) and select ‘Show Package Contents’.
- In the `Resources` folder, open the file `Autocar preferences.txt` in a text editor.

Each preference is explained in the file. More details and examples are on the wiki: [Preferences](https://github.com/multigreg/autocar/wiki/Preferences)
## Credits
Prior implementations of the ‘complete and await a reply’ automation:
- The popular [Complete and Await Reply](http://curtclifton.net/complete) in AppleScript by Curt Clifton.
- [Delegation actions for OmniFocus](https://github.com/ksalzke/delegation-omnifocus-plugin) with Omni Automation, by Kaitlin Salzke.
- [Complete and Await Reply](https://omni-automation.com/omnifocus/plug-in-complete-await.html) with Omni Automation, by Rosemary Orchard.


Thanks to Thomas Kern for his valuable feedback and to [Rob Trew](https://github.com/robtrew) for his tips.
