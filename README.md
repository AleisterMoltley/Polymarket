# 🤠 Polymarket Trading Bot - The "Even My Grandma Could Do This" Guide

## Howdy, Partner! 👋

So, ya wanna get this fancy computer thingy runnin' on yer Mac? Don't you worry your pretty little head about it! I'm gonna walk ya through this like we're buildin' a birdhouse together - one piece at a time, nice and easy!

**This guide is written for COMPLETE beginners. If you've never used a computer terminal before, this is for you!**

---

## 📖 Table of Contents (What We're Gonna Do Today)

1. [What Even IS This Thing?](#-what-even-is-this-thing)
2. [First Things First - Opening the Magic Black Box (Terminal)](#-first-things-first---opening-the-magic-black-box-terminal)
3. [Installing Homebrew - The App Store for Nerds](#-installing-homebrew---the-app-store-for-nerds)
4. [Installing Node.js - The Engine That Makes It Go Vroom](#-installing-nodejs---the-engine-that-makes-it-go-vroom)
5. [Getting the Code - Like Downloading a Recipe](#-getting-the-code---like-downloading-a-recipe)
6. [Setting Things Up - Putting the Pieces Together](#-setting-things-up---putting-the-pieces-together)
7. [Running the Bot - Let 'Er Rip!](#-running-the-bot---let-er-rip)
8. [Updating Everything - Keeping It Fresh](#-updating-everything---keeping-it-fresh)
9. [Troubleshooting - When Things Go Sideways](#-troubleshooting---when-things-go-sideways)

---

## 🤔 What Even IS This Thing?

Alright, imagine you got a really smart robot friend who watches the betting markets for ya while you're out fishin' or nappin' on the porch.

**This bot:**
- 👀 Watches Polymarket (a website where people bet on stuff happening)
- 🧠 Figures out when something looks like a good deal
- 💰 Can pretend to make bets (paper trading - no real money!) or make real ones

Think of it like having a very attentive squirrel who never sleeps and is REALLY good at math!

> ⚠️ **IMPORTANT WARNING - PLEASE READ!** ⚠️
> 
> When you use "Live Trading" mode, **you're using REAL MONEY!** Just like gambling at a casino, you can LOSE money. Please:
> - 🎓 **Learn first** - Use "Paper Trading" mode to practice (no real money!)
> - 💸 **Only bet what you can afford to lose** - Never use rent money or savings!
> - 🧠 **Understand the risks** - Trading is risky business, y'all!
> - 👨‍👩‍👧 **If you're a kid** - Get your parents' permission and help first!

---

## 💻 First Things First - Opening the Magic Black Box (Terminal)

The **Terminal** is like a text-message conversation with your computer. Instead of clicking buttons, you TYPE what you want it to do. Scary? Nah! It's actually pretty fun once ya get the hang of it!

### How to Open Terminal on Your Mac:

**Option 1 - The Easy Way:**
1. Press `Command (⌘)` + `Spacebar` at the same time (this opens Spotlight - it's like asking your Mac "Hey, find something for me!")
2. Type: `Terminal`
3. Press `Enter`

**Option 2 - The Click-Around Way:**
1. Click on **Finder** (the smiley face icon in your dock)
2. Click **Applications** on the left side
3. Open the **Utilities** folder
4. Double-click **Terminal**

🎉 **BOOM!** You should see a white or black window with some text. That's the Terminal! It might look scary, but it's just a fancy text box.

**What You'll See:**
```
yourname@yourmac ~ %
```
That blinking cursor? That's your computer sayin' "I'm listenin', what do ya want?"

---

## 🍺 Installing Homebrew - The App Store for Nerds

**Homebrew** is like the App Store, but for programmer stuff. It lets you install things by just typing a command. Pretty neat, huh?

### Step 1: Copy This Magic Spell 🪄

Open your Terminal and **copy-paste** this ENTIRE thing (yes, the whole dang line):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**How to paste in Terminal:**
- Press `Command (⌘)` + `V`
- OR right-click and select "Paste"

### Step 2: Press Enter and Wait

After you paste it, press `Enter`. 

The computer might ask for your **password**. That's the same password you use to log into your Mac!

**IMPORTANT:** When you type your password, YOU WON'T SEE ANYTHING APPEAR! No dots, no stars, NOTHING! This is normal - your Mac is just being sneaky about security. Type it anyway and press `Enter`!

### Step 3: Wait Some More ⏳

This might take a few minutes. Go make yourself a sandwich. Have some lemonade. When it's done, you'll see your blinking cursor again.

### Step 4: Add Homebrew to Your Path (Super Important!)

After Homebrew installs, it might tell you to run some extra commands. They usually look something like this:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**Just copy and paste these lines one at a time, pressing Enter after each one!**

### Step 5: Check If It Worked! ✅

Type this and press Enter:

```bash
brew --version
```

If you see something like `Homebrew 4.x.x` - **YEEHAW! 🤠 It worked!**

---

## 🟢 Installing Node.js - The Engine That Makes It Go Vroom

**Node.js** is like the engine in a truck. Without it, the truck (our bot) ain't goin' nowhere!

### Step 1: Install NVM (Node Version Manager) First

NVM lets you install different versions of Node.js easily. It's like having a key ring with different keys for different trucks!

**Copy-paste this into Terminal:**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Press `Enter` and wait for it to finish!

### Step 2: Reload Your Terminal

After NVM installs, type this:

```bash
source ~/.zshrc
```

OR just close Terminal completely and open it again!

### Step 3: Install Node.js Version 25

This bot needs Node.js version 25 or newer. Let's get it!

```bash
nvm install 25
```

Wait for it to download and install (might take a minute or two).

### Step 4: Tell Your Computer to Use Node 25

```bash
nvm use 25
```

### Step 5: Check If It Worked! ✅

```bash
node --version
```

You should see something like `v25.x.x`. If you do - **HOT DIGGITY DOG! 🌭 You're doin' great!**

---

## 📥 Getting the Code - Like Downloading a Recipe

Now we need to download the actual bot code. It's like getting a recipe before you can cook!

### Step 1: Install Git (If You Don't Have It)

Git is a tool that lets you download code from the internet. Let's make sure you have it:

```bash
brew install git
```

### Step 2: Pick Where to Put the Code

Let's put it in your home folder. First, make sure you're there:

```bash
cd ~
```

The `cd` command is like walking to a different room in your house. `~` means "my home folder".

### Step 3: Download (Clone) the Code

```bash
git clone https://github.com/AleisterMoltley/Polymarket.git
```

This creates a folder called `Polymarket` with all the code inside!

### Step 4: Go Into the Folder

```bash
cd Polymarket
```

Now you're inside the project folder. You can check what's there by typing:

```bash
ls
```

`ls` means "list stuff here" - you should see a bunch of files!

---

## 🔧 Setting Things Up - Putting the Pieces Together

### Step 1: Install Dependencies (The Bot's Groceries)

The bot needs some extra stuff to work. Let's get 'em:

```bash
npm install
```

**npm** = Node Package Manager. Think of it as going to the store to buy all the ingredients on your shopping list!

This might take a minute. Lots of text will scroll by - that's normal!

### Step 2: Create Your Settings File

The bot needs to know some secrets (like your API keys). Let's create a settings file:

```bash
cp .env.example .env
```

This copies the example settings file and names it `.env`!

### Step 3: Edit Your Settings

You'll need to open the `.env` file and fill in your details. You can use any text editor. Here's how to open it with the built-in editor:

```bash
nano .env
```

You'll see a bunch of settings. Don't worry if you don't understand everything! The main ones you MIGHT need to change are:
- API keys (if you have 'em)
- Trading mode (`paper` is safe for practice!)

**To save and exit nano:**
1. Press `Control` + `X`
2. Press `Y` (for Yes, save it)
3. Press `Enter`

---

## 🚀 Running the Bot - Let 'Er Rip!

Alright, moment of truth! Let's fire this bad boy up!

### For Development (Testing Things Out):

```bash
npm run dev
```

### For Production (The Real Deal):

First, build it:
```bash
npm run build
```

Then run it:
```bash
npm start
```

### 🎉 SUCCESS!

You should see some text saying the server is running! Open your web browser and go to:

**http://localhost:3000**

You'll see the fancy dashboard! 

**CONGRATULATIONS! You did it! 🎊🎉🥳**

---

## 🔄 Updating Everything - Keeping It Fresh

Just like your truck needs oil changes, your computer stuff needs updates too!

### Updating Homebrew:

```bash
brew update && brew upgrade
```

This updates Homebrew AND all the stuff you installed with it!

### Updating Node.js:

```bash
nvm install 25 --latest
nvm use 25
```

### Updating the Bot Code:

First, go to the bot folder:
```bash
cd ~/Polymarket
```

Then pull the latest changes:
```bash
git pull
```

Then reinstall any new dependencies:
```bash
npm install
```

### Updating npm (The Package Manager):

```bash
npm install -g npm@latest
```

---

## 🆘 Troubleshooting - When Things Go Sideways

Don't panic! Here are fixes for common problems:

### "Command not found: brew"

Homebrew didn't get added to your path. Run these:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
source ~/.zprofile
```

### "Command not found: nvm"

NVM didn't get added to your shell. Try:

```bash
source ~/.zshrc
```

Or close Terminal and open it again!

### "Command not found: node"

You need to tell your terminal to use the node version:

```bash
nvm use 25
```

### "Permission denied" Errors

If you installed Node.js using NVM (like we showed above), you shouldn't see these errors! If you do, try these fixes:

**Option 1 - Reset npm permissions (recommended):**
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

**Option 2 - Reinstall Node.js with NVM:**
```bash
nvm uninstall 25
nvm install 25
nvm use 25
```

> ⚠️ **Note:** Avoid using `sudo` with npm - it can cause more problems than it solves!

### "Port 3000 is already in use"

Something else is using that port. Either close it or use a different port:

```bash
PORT=3001 npm run dev
```

### Something Else Broke?

1. 🔄 Close Terminal and open it again
2. 🔄 Restart your Mac
3. 🔄 Delete the `node_modules` folder and run `npm install` again:
   ```bash
   rm -rf node_modules
   npm install
   ```

---

## 📚 Quick Command Cheat Sheet (Keep This Handy!)

| What You Wanna Do | What to Type |
|-------------------|--------------|
| Open home folder | `cd ~` |
| Open bot folder | `cd ~/Polymarket` |
| See what's in a folder | `ls` |
| Install bot stuff | `npm install` |
| Run in dev mode | `npm run dev` |
| Build for production | `npm run build` |
| Run production | `npm start` |
| Stop the bot | Press `Control` + `C` |
| Update Homebrew | `brew update && brew upgrade` |
| Update Node.js | `nvm install 25 --latest` |
| Check Node version | `node --version` |
| Check npm version | `npm --version` |
| Pull latest code | `git pull` |

---

## 🌟 You Did It!

Look at you! You went from "what's a terminal?" to running a full-blown trading bot! 

**Remember:**
- 🐢 Take it slow - rushing leads to mistakes
- 📖 Read the error messages - they often tell you what's wrong
- 🔄 When in doubt, restart Terminal
- ❓ It's okay to not understand everything right away

Now go on, you beautiful genius, and may your trades be ever in your favor! 🍀

---

**For the Full Technical Documentation**, see the detailed setup guides:
- 📱 [Detailed macOS Setup](docs/MacSetup.md)
- 🪟 [Windows Setup](docs/WindowsSetup.md)  
- 🏗️ [Architecture Documentation](docs/Architecture.md)

---

<div align="center">

**Made with 💖 for folks who think computers are scary (they're not!)**

*"The only stupid question is the one you don't ask!"*

</div>