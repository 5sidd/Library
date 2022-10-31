const express = require('express');
const app = express();
require('dotenv').config();

//DB info
const mysql = require('mysql');
const connection = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD
});

/*
connection.connect((error) => {
    if (error) {
        console.log(error);
    }
});
connection.query(`use Library`);
*/

app.use(express.json());

//API Routes

//Get/filter books by book ISBN, book title, book author
app.get('/books', async (req, res) => {
    try {
        const { isbn, title, author } = req.query;
        let q = 'select CD.Isbn, Title, Author_id, `Name`, Loan_id from (select Isbn, Title, BC.Author_id, `Name` from (select BOOK.Isbn, Title, AB.Author_id from BOOK_AUTHORS as AB join BOOK on AB.Isbn = BOOK.Isbn) as BC join AUTHORS on BC.Author_id = AUTHORS.Author_id) as CD left join BOOK_LOANS on CD.Isbn = BOOK_LOANS.Isbn';
        let w = 'WHERE';

        //console.log(isbn, title, author);

        if (isbn) {
            if (w === 'WHERE') {
                w += ` Isbn = ${isbn}`
            }
            else {
                w += ` AND Isbn = ${isbn}`
            }
        }

        if (title) {
            if (w === 'WHERE') {
                w += ` UPPER(Title) LIKE UPPER('%${title}%')`;
            }
            else {
                w += ` AND UPPER(Title) LIKE UPPER('%${title}%')`;
            }
        }

        if (author) {
            if (w === 'WHERE') {
                w += ` UPPER(Name) LIKE UPPER('%${author}%')`;
            }
            else {
                w += ` AND UPPER(Name) LIKE UPPER('%${author}%')`;
            }
        }

        if (w !== 'WHERE') {
            q += ' ';
            q += w;
        }

        let books = await new Promise((resolve, reject) => {
            connection.query(q, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        return res.status(200).json({ books });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error });
    }
});

//Add new borrower to the database
app.post('/borrowers', async (req, res) => {
    try {
        const { ssn, name, address, phone } = req.body;

        function generateCardID() {
            id = '';
            for (let i = 0; i < 20; i++) {
                digit = Math.floor(Math.random() * 10);
                id += digit.toString();
            }

            return id;
        }

        if (/^[a-zA-Z() ]+$/.test(name) === false) {
            return res.status(400).json({ error: 'Name can only contain alphabetical letters' });
        }

        if (name.length > 100) {
            name = name.subtring(0, 100);
        }

        if (ssn.length === 11) {
            if (/[0-9]{3}-[0-9]{2}-[0-9]{4}/.test(ssn) === false) {
                return res.status(400).json({ error: 'Invalid SSN' });
            }
        }
        else {
            return res.status(400).json({ error: 'Invalid SSN' });
        }

        if (address.length > 200) {
            address = address.substring(0, 100);
        }

        if (phone.length === 10) {
            if (/[0-9]{10}/.test(phone) === false) {
                return res.status(400).json({ error: 'Invalid phone number' });
            }
        }
        else {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        let isValidSSN = await new Promise((resolve, reject) => {
            connection.query(`SELECT * FROM BORROWER WHERE Ssn = '${ssn}'`, (error, results, fields) => {
                if (error) {
                    reject(error)
                }
                else {
                    resolve(results);
                }
            });
        });

        if (isValidSSN.length > 0) {
            return res.status(400).json({ error: 'Given SSN already exists' });
        }

        let borrowers = await new Promise((resolve, reject) => {
            connection.query('select Card_id from BORROWER', (error, results) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        let allCardIDs = [];
        for (let i = 0; i < borrowers.length; i++) {
            allCardIDs.push(borrowers[i].Card_id);
        }
        let uniqueIDs = new Set(allCardIDs);

        let cardID;
        let isValid = false;
        while (isValid === false) {
            cardID = generateCardID();
            if (uniqueIDs.has(cardID) === false) {
                isValid = true;
            }
        }

        let finalResult = await new Promise((resolve, response) => {
            connection.query(`INSERT INTO BORROWER VALUES ('${cardID}', '${ssn}', '${name}', '${address}', '${phone}')`, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        }); 

        return res.status(201).json({ result: finalResult });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error });
    }
});

const port = process.env.PORT || 3000;
const start = async () => {
    try {
        await new Promise((resolve, reject) => {
            connection.connect((error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });

        await new Promise((resolve, reject) => {
            connection.query(`use Library`, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });

        app.listen(port, () => {
            console.log(`Server is listening on port ${port}`);
        });
    }
    catch (error) {
        console.log(error)
    }
}

start();