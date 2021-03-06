export default function flushCollections(assert, db, done) {
  const animals = db.collection('animals');
  const people = db.collection('people');
  const users = db.collection('users');
  const computers = db.collection('computers');

  animals.remove(animalsErr => {
    assert.error(animalsErr, 'no errors when removing animals collection');

    people.remove(peopleErr => {
      assert.error(peopleErr, 'no errors when removing people collection');

      users.remove(usersErr => {
        assert.error(usersErr, 'no errors when removing users collection');

        computers.remove(computersErr => {
          assert.error(computersErr, 'no errors when removing computers collection');
          done();
        });
      });
    });
  });
}
