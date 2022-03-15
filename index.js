import puppeteer from "puppeteer-extra";
import { $ } from "puppeteer-shadow-selector";
import fs from 'fs';
// const readline = require('readline');
// const chalk = require('chalk');
// const process = require('process');

class WordleSolver {
    constructor(wordBank) {
        this.wordBank = wordBank;
        this.executablePath = './node_modules/puppeteer/.local-chromium/win64-970485/chrome-win/chrome.exe';
        // this.defaultTimeOut = 20000;
        // this.timer;
        this.openerWord = 'fudge';
        this.isRandomWord = true;
        this.headless = false;
        this.args = [
            '--start-maximized', // you can also use '--start-fullscreen'
            // `-profile-directory=${this.profile}`
        ];
        this.dumpWords = [];
        this.absentLetters = [];
        this.avoidLetters = [
            [],
            [],
            [],
            [],
            []
        ];
        this.presentLetters = [];
        this.correctLetters = Array(5).fill('');
        this.historyWords = [];
    }

    async initBrowser() {
        console.log('Open browser');
        this.browser = await puppeteer.launch({
            executablePath: this.executablePath,
            headless: this.headless,
            defaultViewport: null,
            // userDataDir: this.userDataDir,
            args: this.args
        });
    }

    async runProcedure(delay, callback) {
        await this.page.waitForTimeout(delay);
        await callback;
    }

    async runFunction(delay, callback) {
        await this.page.waitForTimeout(delay);
        return await callback;
    }

    async getInnerHTML(elm) {
        const elmProperty = await elm.getProperty('innerHTML');
        return await elmProperty.jsonValue();
    }

    async click(elm) {
        await elm.click();
    }

    async submit(text) {
        for (let i = 0; i < 5; i++) {
            await this.page.keyboard.press('Backspace');
        }
        let counter = 0;
        while (counter < text.length) {
            await this.page.waitForTimeout(200);
            await this.page.keyboard.type(text[counter]);
            counter++;
        }
        await this.page.keyboard.press('Enter');
    }

    async getEvaluation(word) {
        const gameRow = await $(this.page, `game-app::shadow-dom(game-theme-manager game-row[letters="${word}"]::shadow-dom(div))`);
        const gameTiles = await gameRow.$$(':scope > *');
        const evaluation = [];
        for (let gameTile of gameTiles) {
            const attr = await this.page.evaluate(el => el.getAttribute("evaluation"), gameTile);
            evaluation.push(attr);
        }
        return evaluation;
    }

    isSingleLetter(letter, word) {
        let counter = 0;
        for (let i = 0; i < word.length; i++) {
            if (letter === word[i]) {
                counter++;
            }
        }
        if (counter == 1) {
            return true;
        } else {
            return false;
        }
    }

    checkWord(word) {
        let res = false;
        let flagHistory = false;
        let flagAbsent = false;
        let flagPresent = false;
        let flagAvoid = false;
        let flagCorrect = false;
        if (this.historyWords.includes(word)) {
            flagHistory = true;
        }
        for (let i = 0; i < this.absentLetters.length; i++) {
            if (word.includes(this.absentLetters[i])) {
                flagAbsent = true;
                break;
            }
        }
        if (this.presentLetters.length) {
            for (let i = 0; i < this.presentLetters.length; i++) {
                if (word.includes(this.presentLetters[i])) {
                    if (i == this.presentLetters.length - 1) {
                        flagPresent = true;
                    }
                } else {
                    break;
                }
            }
        } else {
            flagPresent = true;
        }
        for (let i = 0; i < this.avoidLetters.length; i++) {
            if (this.avoidLetters[i].length) {
                for (let j = 0; j < this.avoidLetters[i].length; j++) {
                    if (this.avoidLetters[i][j] === word[i]) {
                        flagAvoid = true;
                        break;
                    }
                }
            }
        }
        for (let i = 0; i < this.correctLetters.length; i++) {
            if (this.correctLetters[i] != '') {
                if (this.correctLetters[i] != word[i]) {
                    break;
                }
            }
            if (i == this.correctLetters.length - 1) {
                flagCorrect = true;
            }
        }
        if (!flagHistory && !flagAbsent && flagPresent && !flagAvoid && flagCorrect) {
            res = true;
        }
        // console.log('history : ', flagHistory);
        // console.log('absent : ', flagAbsent);
        // console.log('present : ', flagPresent);
        // console.log('avoid : ', flagAvoid);
        // console.log('correct : ', flagCorrect);
        return res;
    }

    randomPick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    winCheker() {
        return this.correctLetters.filter(letter => letter != '').length == 5;
    }

    async toDo() {
        try {
            this.page = await this.browser.newPage();
            await this.page.goto('https://www.nytimes.com/games/wordle/index.html');
            console.log('Success open link');
            const popUp = await $(this.page, `game-app::shadow-dom(game-theme-manager > header)`);
            await this.runProcedure(500, this.click(popUp));
            let evaluationTemp;
            let tempWord = this.isRandomWord ? this.randomPick(this.wordBank) : this.openerWord;
            let counter = 1;
            while (true) {
                console.log('============= Try ' + counter + ' =============');
                console.log('lucky word:', tempWord);
                this.historyWords.push(tempWord);
                await this.runProcedure(3000, this.submit(tempWord));
                evaluationTemp = await this.runFunction(1000, this.getEvaluation(tempWord));
                console.log(evaluationTemp);
                evaluationTemp.forEach((letter, index) => {
                    switch (letter) {
                        case 'correct':
                            this.correctLetters[index] = tempWord[index];
                            break;
                        case 'present':
                            if (!this.presentLetters.includes(tempWord[index])) {
                                this.presentLetters.push(tempWord[index]);
                            }
                            this.avoidLetters[index].push(tempWord[index]);
                            break;
                        case 'absent':
                            if (this.isSingleLetter(tempWord[index], tempWord)) {
                                this.absentLetters.push(tempWord[index]);
                            }
                            break;
                    }
                });
                console.log('correct:', this.correctLetters);
                console.log('possible:', this.presentLetters);
                console.log('avoid:', this.avoidLetters);
                console.log('absent:', this.absentLetters);
                if (this.winCheker()) {
                    console.log('============= You Win =============');
                    await this.page.waitForTimeout(5000);
                    await this.browser.close();
                    break;
                }
                this.dumpWords = this.wordBank.filter(word => this.checkWord(word));
                console.log('filtered words:', this.dumpWords);
                tempWord = this.randomPick(this.dumpWords);
                counter++;
            }
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
    fs.readFile('./wordbank.txt', function(err, data) {
        if (err) throw err;
        let allWords = data.toString().split("\n").map(v => v.trim().toLowerCase());
        let allFiveLetter = allWords.filter(v => v.length === 5);
        const solver = new WordleSolver(allFiveLetter);
        solver.start();
    });
})()