#!/usr/bin/env node
import { Command } from 'commander'
import { init } from './commands/init'
import { migrate } from './commands/migrate'
import { adminCommand } from './commands/admin'

const program = new Command()

program
  .name('fortis')
  .description('Fortis authentication CLI')
  .version('0.1.0')

program
  .command('init')
  .description('Initialize Fortis — creates DynamoDB tables, configures SES, outputs Terraform')
  .option('-r, --regions <regions>', 'comma-separated AWS regions', 'us-east-1')
  .option('--primary <region>', 'primary region for users table', 'us-east-1')
  .action(init)

program
  .command('migrate')
  .description('Run database migrations')
  .action(migrate)

program
  .command('admin')
  .description('Admin commands')
  .addCommand(
    new Command('create-user')
      .description('Create a user')
      .requiredOption('-e, --email <email>')
      .requiredOption('-p, --password <password>')
      .action(adminCommand.createUser)
  )
  .addCommand(
    new Command('ban-user')
      .description('Ban a user')
      .requiredOption('-e, --email <email>')
      .action(adminCommand.banUser)
  )
  .addCommand(
    new Command('delete-user')
      .description('Delete a user')
      .requiredOption('-e, --email <email>')
      .action(adminCommand.deleteUser)
  )

program.parse()
