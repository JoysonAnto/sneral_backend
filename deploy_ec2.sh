#!/bin/bash
set -e

echo "Creating Security Group..."
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text)
# check if SG exists
SG_ID=$(aws ec2 describe-security-groups --group-names snearal-backend-sg --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || true)
if [ -z "$SG_ID" ] || [ "$SG_ID" = "None" ]; then
    SG_ID=$(aws ec2 create-security-group --group-name snearal-backend-sg --description "SG for Snearal Backend" --vpc-id $VPC_ID --query "GroupId" --output text)
    echo "Adding inbound rules to SG..."
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0 > /dev/null || true
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0 > /dev/null || true
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0 > /dev/null || true
else
    echo "Security group already exists: $SG_ID"
fi

echo "Creating Key Pair..."
if [ ! -f snearal-backend-key.pem ]; then
    aws ec2 create-key-pair --key-name snearal-backend-key --query "KeyMaterial" --output text > snearal-backend-key.pem || echo "Key might already exist"
    chmod 400 snearal-backend-key.pem
fi

echo "Launching EC2 Instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id ami-002a6ae76416021fe \
    --count 1 \
    --instance-type t3.micro \
    --key-name snearal-backend-key \
    --security-group-ids $SG_ID \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=snearal-backend}]' \
    --query "Instances[0].InstanceId" \
    --output text)

echo "Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

PUBLIC_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query "Reservations[0].Instances[0].PublicIpAddress" --output text)

echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo $PUBLIC_IP > ec2_public_ip.txt
