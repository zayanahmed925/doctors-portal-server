const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId, Logger } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

// doctor_portal
// O4UMQ4TE65lv3ZNG
const uri = `mongodb+srv://doctor_portal:O4UMQ4TE65lv3ZNG@cluster0.x5yvkrr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(404).send({ message: 'UnAuthorized Access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    });
}


async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors-portal').collection('services');
        const userCollection = client.db('doctors-portal').collection('users');
        const doctorCollection = client.db('doctors-portal').collection('doctor');
        const bookingCollection = client.db('doctors-portal').collection('booking');
        const hospitalCollection = client.db('doctors-portal').collection('hospitals');
        const departmentCollection = client.db('doctors-portal').collection('departments');
        
    
        //verify admin
        //all users get
        app.get('/test', (req, res) => {
            res.send({ message: 'hello' })
        })
        app.get('/users', verifyJwt, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        })
        // For Test
        // app.get('/booking', verifyJwt, verifyAdmin, async (req, res) => {
        //     const booked = await bookingCollection.find().toArray();
        //     res.send(booked);
        // })
        //verify admin
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({ email: requester })
            
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                res.status(403).send({ message: 'Forbidden Access' })
            }
        }


        //Load all service
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 })
            const services = await cursor.toArray();
            
            res.send(services);
        })

        // create hospital
        app.post('/hospital', async (req, res) => {
            const hospital = req.body
            const result = await hospitalCollection.insertOne(hospital);
            return res.send({ success: true, result });
        }) 

        // get all hospital
        app.get('/hospitals', async (req, res) => {
            const query = {};
            const cursor = hospitalCollection.find()
            const hospital = await cursor.toArray();
            
            res.send(hospital)
        })

        // create department
        app.post('/department', async (req, res) => {
            const department = req.body
            const result = await departmentCollection.insertOne(department);
            return res.send({ success: true, result });
        }) 

        // get department by hospital
        app.get('/departments/:hospitalId', async (req, res) => {
            const hospitalId = req.params.hospitalId;
            const departments = await departmentCollection.find({ hospital: hospitalId }).toArray()

            // const result = await departmentCollection.insertOne(department)
            res.send(departments)
        })

        // get all department
        app.get('/departments', async (req, res) => {
            const query = {};
            const cursor = departmentCollection.find()
            const departments = await cursor.toArray();
           
            res.send(departments)
        })

        //For appointment booking 
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            // console.log(booking)
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })

        //For user wise appointment history 
        app.get('/booking', async (req, res) => {
            const patientEmail = req.query.patient; // Get the value of 'patient' query parameter
            
            // Query MongoDB for appointments with the given patient email
            const appointments = await bookingCollection.find({ 'patient': patientEmail }).toArray();;

            // Respond with JSON data
            // res.json(bookingData);
            res.send(appointments)
        })

         //For all appointment history 
         app.get('/booking/all', async (req, res) => {
            
            // Query MongoDB for appointments with the given patient email
            const appointments = await bookingCollection.find().toArray();;

            // Respond with JSON data
            // res.json(bookingData);
            res.send(appointments)
        })


        //make admin role
        app.put('/user/admin/:email', verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;

            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);

        })
        //Get admin
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            // console.log(email);
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user?.role === 'admin';
            res.send({ admin: isAdmin })
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
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' })
            console.log(token);
            res.send({ result, token });
        })
        //doctor data post
        app.post('/doctor', verifyJwt, verifyAdmin, async (req, res) => {
            let doctor = req.body;
            
            const departmentId = ObjectId(doctor.department)
            const cursor = await departmentCollection.findOne({ _id: departmentId })
            const department = {
                '_id': cursor._id.toHexString(), // Convert ObjectId to string
                'name': cursor.name
            }

            const hospitalId = ObjectId(doctor.hospital)
            const hospitalCursor = await hospitalCollection.findOne({ _id: hospitalId })
            const hospital = {
                '_id': hospitalCursor._id.toHexString(), // Convert ObjectId to string
                'name': hospitalCursor.name,
                'district': hospitalCursor.district,
            }
            doctor['department'] = department
            doctor['hospital'] = hospital
            
            const result = await doctorCollection.insertOne(doctor);
            res.send(result)
        })
        //get all doctor
        app.get('/doctor', verifyJwt, verifyAdmin, async (req, res) => {
            const doctors = await doctorCollection.find().toArray(); 
            res.send(doctors);
        })

        //get  doctor department wise
        app.get('/doctor/:departmentId', async (req, res) => {
            // const departmentId = req.params.departmentId;
            const departmentId = ObjectId(req.params.departmentId); // Replace with actual ObjectId

            // Query to find doctors by departmentId
            const doctors = await doctorCollection.find({ 'department._id': req.params.departmentId }).toArray();
            // const doctors = await doctorCollection.find({ hospital: departmentId }).toArray();
            console.log('doctors', doctors);

            
            res.send(doctors);
        })

        //Delete a doctor
        app.delete('/doctor/:email', verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await doctorCollection.deleteOne(filter);
            res.send(result)
        })

        app.get('/available', async (req, res) => {
            console.log('api connect');
            const date = req.query.date
            // console.log(date)
            //Step 1: get all services
            const services = await serviceCollection.find({}).toArray();
            //step 2: get the booking of that day
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            // console.log(bookings)
            //step 3: for each service, find bookings for that service: [{},{},{},{}..]
            services?.forEach(service => {
                //step 4: Find bookings for that service : [{},{},{}]
                const serviceBookings = bookings.filter(book => book.treatment === service.name)
                // console.log(serviceBookings);
                //step 5: select slot for the service bookings : ['','','']
                const bookedSlots = serviceBookings.map(book => book.slot)
                // console.log(bookedSlots);
                //step 6: Select those slots that are not in bookedSlots
                const available = service?.slots?.filter(slot => !bookedSlots.includes(slot))
                // service.slots = available
            })
            res.send(services)


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