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
connection.connect((error) => {
    if (error) {
        console.log(error);
    }
});
connection.query(`use Library`);

app.use(express.json());

//API Routes

//Get/filter books by book ISBN, book title, book author
app.get('/books', async (req, res) => {
    try {
        const { isbn, title, author } = req.query;
        let q = 'select CD.Isbn, Title, Author_id, `Name`, Loan_id from (select Isbn, Title, BC.Author_id, `Name` from (select BOOK.Isbn, Title, AB.Author_id from BOOK_AUTHORS as AB join BOOK on AB.Isbn = BOOK.Isbn) as BC join AUTHORS on BC.Author_id = AUTHORS.Author_id) as CD left join BOOK_LOANS on CD.Isbn = BOOK_LOANS.Isbn';
        let w = 'WHERE';

        console.log(isbn, title, author);

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

        connection.query(q, (error, results, fields) => {
            if (error) {
                return res.status(500).json({ error });
            }

            return res.status(200).json({ books: results });
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error });
    }
});

/*
app.get('/books/:id', async (req, res) => {
    try {
        let isbn = req.params.id;
        isbn = isbn.toString();

        if (isbn.length !== 10 || !isbn.match(/^[a-z0-9]+$/i)) {
            return res.status(400).json({ error: 'Invalid ISBN'});
        }

        let q = `SELECT * FROM BOOK WHERE Isbn = '${isbn}'`;
        connection.query(q, (error, results, fields) => {
            if (error) {
                return res.status(500).json({ error });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: `Could not find a book with ISBN ${isbn}`});
            }

            return res.status(200).json({ books: results });
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error });
    }
});
*/

//Add new borrower to the database --> STILL IN PROGRESS
app.post('/borrowers', async (req, res) => {
    try {
        const { name, ssn, address, phone } = req.body;

        if (/^[a-zA-Z() ]+$/.test(name) === False) {
            return res.status(400).json({ error: 'Name can only contain alphabetical letters'});
        }

        if (name.length > 100) {
            name = name.subtring(0, 100);
        }

        if (ssn.length === 11) {
            if (/[0-9]{3}-[0-9]{3}-[0-9]{4}/.test(ssn) === false) {
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
                return res.status(400).json({ error: 'Invalid phone number'});
            }
        }
        else {
            return res.status(400).json({ error: 'Invalid phone number'});
        }


    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error });
    }
});

const port = process.env.PORT || 3000;
const start = () => {
    app.listen(port, () => {
        console.log(`Server is listening on port ${port}`);
    });
}

start();