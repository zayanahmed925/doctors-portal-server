const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_pass}@cluster0.x5jqn.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors-portal').collection('services');
        const bookingCollection = client.db('doctors-portal').collection('booking');
        const userCollection = client.db('doctors-portal').collection('users');

        //Load all service
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query)
            const services = await cursor.toArray();
            res.send(services);
        })
        //update 
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ result, token });
        })
        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 16, 2022';
            // console.log(date)
            //Step 1: get all services
            const services = await serviceCollection.find({}).toArray();
            //step 2: get the booking of that day
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            console.log(bookings)
            //step 3: for each service, find bookings for that service: [{},{},{},{}..]
            services.forEach(service => {
                //step 4: Find bookings for that service : [{},{},{}]
                const serviceBookings = bookings.filter(book => book.treatment === service.name)
                //step 5: select slot for the service bookings : ['','','']
                const bookedSlots = serviceBookings.map(book => book.slot)
                //step 6: Select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))
                service.slots = available
            })

            res.send(services)
        })
        //booking collect for dashboard
        app.get('/booking', async (req, res) => {
            const patient = req.query.patient
            // console.log(patient)
            const query = { patient: patient }
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
        })

        //booking data insert
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
            const exist = await bookingCollection.findOne(query);
            if (exist) {
                return res.send({ success: false, booking: exist })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result })
        })
    }

    finally {

    }


}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Running doctors portal server');
})
app.listen(port, () => {
    console.log('Listening to port', port);
})