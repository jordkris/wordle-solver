import puppeteer from "puppeteer-extra";
import { $ } from "puppeteer-shadow-selector";
// const puppeteer = require('puppeteer-extra');
// const shadow = require('puppeteer-shadow-selector');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
import csv from 'csvtojson';
import fs from 'fs';
// const readline = require('readline');
// const chalk = require('chalk');
// const process = require('process');
// puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
// puppeteer.use(StealthPlugin());
// puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')())
// puppeteer.use(require('puppeteer-extra-plugin-user-preferences')({
//     userPrefs: {
//         webkit: {
//             webprefs: {
//                 default_font_size: 16
//             }
//         }
//     }
// }));

class WordleSolver {
    constructor(content) {
        this.content = content;
        this.executablePath = './node_modules/puppeteer/.local-chromium/win64-970485/chrome-win/chrome.exe';
        // this.executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
        // this.userDataDir = 'C:/Users/ASUS A407UA/AppData/Local/Google/Chrome/User Data';
        // this.executablePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
        // this.userDataDir = 'C:/Users/HP/AppData/Local/Microsoft/Edge/User Data';

        this.args = [];
        this.defaultTimeOut = 20000;
        this.timer;
        this.headless = false;
        // this.args = ['--start-maximized', '--auto-open-devtools-for-tabs'];
        this.args = [
            '--start-maximized', // you can also use '--start-fullscreen'
            // `-profile-directory=${this.profile}`
        ];
    }

    async initBrowser() {
        console.log('Open browser');
        this.browser = await puppeteer.launch({
            executablePath: this.executablePath,
            headless: false,
            defaultViewport: null,
            // userDataDir: this.userDataDir,
            args: this.args
        });
    }

    async run(delay, func) {
        await this.page.waitForTimeout(delay);
        await func;
    }

    async getInnerHTML(elm) {
        const elmProperty = await elm.getProperty('innerHTML');
        return await elmProperty.jsonValue();
    }

    async click(elm) {
        await elm.click();
    }

    async submit(text) {
        let counter = 0;
        while (counter < text.length) {
            await this.page.waitForTimeout(200);
            await this.page.keyboard.type(text[counter]);
            counter++;
        }
        await this.page.keyboard.press('Enter');
    }

    async toDo() {
        try {
            this.page = await this.browser.newPage();
            await this.page.goto('https://www.nytimes.com/games/wordle/index.html');
            console.log('Success open link');
            // await this.run(2000, this.page.click('div.title'));
            // or await $(page, `my-component::shadow-dom([part="text"])`);
            // or await $(page, `my-component::shadow-dom(input)`);
            const elm = await $(this.page, `game-app::shadow-dom(game-theme-manager > header)`);
            // const res = await this.getInnerHTML(elm);
            // console.log(res);
            await this.click(elm);
            await this.run(1000, this.submit('focus'));
        } catch (e) {
            console.log(e);
        }
    }

    async start() {
        await this.initBrowser();
        console.log('Success open browser');
        await this.toDo();
    }
}
(async() => {
    // const csvFilePath = './wordbank.csv'
    // csv()
    //     .fromFile(csvFilePath)
    //     .then((content) => {
    //         // const profileOneTool = new SiteCreator(content, 'Profile 8');
    //     });
    fs.readFile('./wordbank.txt', function(err, data) {
        if (err) throw err;
        let allWords = data.toString().split("\n").map(v => v.trim().toLowerCase());
        let allFiveLetter = allWords.filter(v => v.length === 5);
        // console.log(allFiveLetter);
        // console.log(allFiveLetter[allFiveLetter.length - 1]);
        const solver = new WordleSolver(allFiveLetter);
        solver.start();
    });
})()