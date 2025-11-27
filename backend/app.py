import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime
import uuid

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app) # Enable CORS for frontend communication

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Models ---

class Loan(db.Model):
    __tablename__ = 'loans'
    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String, nullable=False) # In production, use UUID
    name = db.Column(db.String, nullable=False)
    lender = db.Column(db.String)
    principal = db.Column(db.Float, nullable=False)
    interest_rate = db.Column(db.Float)
    start_date = db.Column(db.Date)
    emi_amount = db.Column(db.Float)
    tenure_months = db.Column(db.Integer)
    initial_paid_months = db.Column(db.Integer, default=0)
    due_date_day = db.Column(db.Integer)
    type = db.Column(db.String)
    status = db.Column(db.String, default='active')
    is_foreclosed = db.Column(db.Boolean, default=False)
    
    # Relationship
    payments = db.relationship('Payment', backref='loan', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'lender': self.lender,
            'principal': self.principal,
            'interestRate': self.interest_rate,
            'startDate': self.start_date.isoformat() if self.start_date else None,
            'emiAmount': self.emi_amount,
            'tenureMonths': self.tenure_months,
            'initialPaidMonths': self.initial_paid_months,
            'dueDateDay': self.due_date_day,
            'type': self.type,
            'status': self.status,
            'isForeclosed': self.is_foreclosed,
            'payments': [p.to_dict() for p in self.payments]
        }

class Payment(db.Model):
    __tablename__ = 'payments'
    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    loan_id = db.Column(db.String, db.ForeignKey('loans.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    note = db.Column(db.String)

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat() if self.date else None,
            'amount': self.amount,
            'note': self.note
        }

class Transaction(db.Model):
    __tablename__ = 'transactions'
    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String, nullable=False)
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    type = db.Column(db.String, nullable=False) # income / expense
    category = db.Column(db.String)
    description = db.Column(db.String)

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat() if self.date else None,
            'amount': self.amount,
            'type': self.type,
            'category': self.category,
            'description': self.description
        }

# --- Routes ---

# 1. Get All Data (Sync)
@app.route('/api/sync', methods=['GET'])
def get_user_data():
    user_id = request.args.get('userId') # In real app, get from Auth Token
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    loans = Loan.query.filter_by(user_id=user_id).all()
    transactions = Transaction.query.filter_by(user_id=user_id).all()

    return jsonify({
        'loans': [l.to_dict() for l in loans],
        'transactions': [t.to_dict() for t in transactions]
    })

# 2. Add/Update Loan
@app.route('/api/loans', methods=['POST'])
def save_loan():
    data = request.json
    user_id = request.args.get('userId')
    
    # Check if exists
    loan = Loan.query.get(data.get('id'))
    
    if not loan:
        loan = Loan(id=data.get('id'), user_id=user_id)
        db.session.add(loan)
    
    # Update fields
    loan.name = data.get('name')
    loan.lender = data.get('lender')
    loan.principal = data.get('principal')
    loan.interest_rate = data.get('interestRate')
    loan.start_date = datetime.strptime(data.get('startDate').split('T')[0], '%Y-%m-%d').date()
    loan.emi_amount = data.get('emiAmount')
    loan.tenure_months = data.get('tenureMonths')
    loan.initial_paid_months = data.get('initialPaidMonths', 0)
    loan.due_date_day = data.get('dueDateDay')
    loan.type = data.get('type')
    loan.status = data.get('status', 'active')
    loan.is_foreclosed = data.get('isForeclosed', False)

    # Handle Payments nested in Loan
    if 'payments' in data:
        # Clear existing (simple strategy for sync) or upsert
        # For simplicity, we can let the separate payment endpoint handle new payments,
        # but if syncing full object:
        pass 

    db.session.commit()
    return jsonify(loan.to_dict())

# 3. Delete Loan
@app.route('/api/loans/<loan_id>', methods=['DELETE'])
def delete_loan(loan_id):
    loan = Loan.query.get(loan_id)
    if loan:
        db.session.delete(loan)
        db.session.commit()
        return jsonify({'message': 'Deleted successfully'})
    return jsonify({'error': 'Loan not found'}), 404

# 4. Add Payment
@app.route('/api/payments', methods=['POST'])
def add_payment():
    data = request.json
    loan_id = data.get('loanId')
    
    payment = Payment(
        id=data.get('id'),
        loan_id=loan_id,
        date=datetime.strptime(data.get('date'), '%Y-%m-%d').date(),
        amount=data.get('amount'),
        note=data.get('note')
    )
    
    db.session.add(payment)
    
    # Check if we need to close the loan (backend logic mirroring frontend)
    loan = Loan.query.get(loan_id)
    # logic to check balance could go here
    
    db.session.commit()
    return jsonify(payment.to_dict())

# 5. Transactions (Budget)
@app.route('/api/transactions', methods=['POST'])
def save_transaction():
    data = request.json
    user_id = request.args.get('userId')
    
    tx = Transaction(
        id=data.get('id'),
        user_id=user_id,
        date=datetime.strptime(data.get('date'), '%Y-%m-%d').date(),
        amount=data.get('amount'),
        type=data.get('type'),
        category=data.get('category'),
        description=data.get('description')
    )
    
    db.session.merge(tx) # Upsert
    db.session.commit()
    return jsonify(tx.to_dict())

@app.route('/api/transactions/<tx_id>', methods=['DELETE'])
def delete_transaction(tx_id):
    tx = Transaction.query.get(tx_id)
    if tx:
        db.session.delete(tx)
        db.session.commit()
        return jsonify({'message': 'Deleted'})
    return jsonify({'error': 'Not found'}), 404

if __name__ == '__main__':
    with app.app_context():
        db.create_all() # Ensure tables exist
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))