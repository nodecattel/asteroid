#!/bin/bash

# Asteroid Setup Wizard for Astroid Trading Bot
# Makes first-time setup easy and streamlined

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ASCII Art Banner
print_banner() {
    echo -e "${BLUE}"
    cat << "EOF"
    ___        __              __         
   /   |  ___ / /____  _______/ /__  _  __
  / /| | / __/ __/ _ \/ ___/ / _ \| |/_/
 / ___ |(__  ) /_/  __/ /  / / /_/ />  <  
/_/  |_/____/\__/\___/_/  /_/\____/_/|_|  
                                          
 Astroid Trading Bot - Setup Wizard
 Volume Bots + AI Autonomous Trading Agents
EOF
    echo -e "${NC}"
}

# Print section headers
print_header() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
}

# Print success message
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Print error message
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Print warning message
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Print info message
print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local all_good=true
    
    if command_exists docker; then
        print_success "Docker is installed ($(docker --version))"
    else
        print_error "Docker is not installed"
        all_good=false
    fi
    
    if command_exists docker-compose; then
        print_success "Docker Compose is installed ($(docker-compose --version))"
    else
        print_error "Docker Compose is not installed"
        all_good=false
    fi
    
    if [ "$all_good" = false ]; then
        print_error "Please install missing prerequisites before continuing"
        echo ""
        print_info "Installation guides:"
        print_info "  Docker: https://docs.docker.com/get-docker/"
        print_info "  Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
}

# Create .env file
create_env_file() {
    print_header "Environment Configuration"
    
    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Do you want to reconfigure? (y/N): " reconfigure
        if [[ ! $reconfigure =~ ^[Yy]$ ]]; then
            return
        fi
        mv .env .env.backup.$(date +%s)
        print_info "Backed up existing .env file"
    fi
    
    echo "Let's set up your environment variables..."
    echo ""
    
    # Bot password for dashboard authentication
    print_warning "Set a password to protect your bot dashboard"
    print_info "This password will be required to access the web interface"
    echo ""
    read -sp "Enter bot dashboard password: " bot_password
    echo ""
    read -sp "Confirm bot dashboard password: " bot_password_confirm
    echo ""
    
    if [ "$bot_password" != "$bot_password_confirm" ]; then
        print_error "Passwords do not match"
        exit 1
    fi
    
    if [ -z "$bot_password" ]; then
        print_error "Bot password is required to protect your dashboard"
        exit 1
    fi
    
    echo ""
    
    # Aster Dex API credentials
    print_warning "You need Aster Dex API credentials to run the bot"
    print_info "Get them from: https://www.asterdex.com/en/api-management"
    echo ""
    read -p "Enter your Aster Dex API Key: " api_key
    read -p "Enter your Aster Dex API Secret: " api_secret
    
    if [ -z "$api_key" ] || [ -z "$api_secret" ]; then
        print_error "API credentials are required to run the bot"
        exit 1
    fi
    
    echo ""
    
    # AI Provider API Keys (Optional)
    print_header "AI Trading Agents Configuration (Optional)"
    print_info "Astroid supports AI-powered autonomous trading agents"
    print_info "Configure API keys for the AI models you want to use:"
    echo ""
    print_info "Available providers:"
    echo "  1) Anthropic (Claude) - https://console.anthropic.com/"
    echo "  2) OpenAI (GPT-4) - https://platform.openai.com/api-keys"
    echo "  3) DeepSeek - https://platform.deepseek.com/"
    echo "  4) xAI (Grok) - https://x.ai/"
    echo "  5) Alibaba (Qwen) - https://dashscope.aliyun.com/"
    echo ""
    print_warning "You can skip this section and add API keys later in .env file"
    echo ""
    read -p "Do you want to configure AI provider API keys now? (y/N): " configure_ai
    
    anthropic_key=""
    openai_key=""
    deepseek_key=""
    xai_key=""
    qwen_key=""
    
    if [[ $configure_ai =~ ^[Yy]$ ]]; then
        echo ""
        print_info "Enter API keys (leave blank to skip):"
        echo ""
        read -p "Anthropic API Key (for Claude models): " anthropic_key
        read -p "OpenAI API Key (for GPT-4 models): " openai_key
        read -p "DeepSeek API Key: " deepseek_key
        read -p "xAI API Key (for Grok models): " xai_key
        read -p "Qwen API Key (for Qwen models): " qwen_key
        echo ""
        
        local configured_count=0
        [ -n "$anthropic_key" ] && ((configured_count++))
        [ -n "$openai_key" ] && ((configured_count++))
        [ -n "$deepseek_key" ] && ((configured_count++))
        [ -n "$xai_key" ] && ((configured_count++))
        [ -n "$qwen_key" ] && ((configured_count++))
        
        if [ $configured_count -gt 0 ]; then
            print_success "Configured $configured_count AI provider(s)"
        else
            print_info "No AI providers configured - you can add them later in .env file"
        fi
    else
        print_info "Skipped AI provider configuration - you can add keys later in .env file"
    fi
    
    echo ""
    
    # Port configuration
    read -p "Enter the port to run the application (default: 5000): " port
    port=${port:-5000}
    
    # Session secret
    session_secret=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    
    # Database choice
    print_header "Database Configuration"
    print_info "Database options:"
    echo "  1) In-memory storage (default, no persistence)"
    echo "  2) PostgreSQL (persistent storage)"
    echo ""
    read -p "Choose database type (1 or 2): " db_choice
    
    database_url=""
    postgres_password=""
    postgres_port="5432"
    if [ "$db_choice" = "2" ]; then
        read -p "Enter PostgreSQL external port (default: 5432): " postgres_port_input
        postgres_port=${postgres_port_input:-5432}
        postgres_password=$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
        database_url="postgresql://asterdex:${postgres_password}@postgres:5432/asterdex"
        print_info "PostgreSQL will be configured on external port ${postgres_port}"
    else
        print_info "In-memory storage will be used (data will not persist)"
    fi
    
    # Create .env file
    cat > .env << EOF
# Astroid Trading Bot - Environment Variables
# Generated by asteroid.sh on $(date)

# Application Port
PORT=$port

# Session Secret (auto-generated)
SESSION_SECRET=$session_secret

# Bot Password Authentication (REQUIRED)
# This password protects access to the dashboard
BOT_PASSWORD=$bot_password

# Aster Dex API Credentials (REQUIRED)
# Get your API keys from: https://www.asterdex.com/en/api-management
ASTERDEX_API_KEY=$api_key
ASTERDEX_API_SECRET=$api_secret

# AI Model Provider API Keys (OPTIONAL - For AI Trading Agents)
# Configure API keys for the AI models you want to use
# Get your API keys from the respective providers
ANTHROPIC_API_KEY=$anthropic_key
OPENAI_API_KEY=$openai_key
DEEPSEEK_API_KEY=$deepseek_key
XAI_API_KEY=$xai_key
QWEN_API_KEY=$qwen_key

# MCP Server Configuration (Optional)
MCP_PORT=3001

# Database Configuration
DATABASE_URL=$database_url

# PostgreSQL Configuration (only used if PostgreSQL is enabled)
POSTGRES_PASSWORD=$postgres_password
POSTGRES_PORT=$postgres_port
EOF
    
    print_success ".env file created successfully"
    
    # Update docker-compose if PostgreSQL selected
    if [ "$db_choice" = "2" ]; then
        print_info "Enabling PostgreSQL in docker-compose.yml..."
        sed -i.bak 's/^  # postgres:/  postgres:/g; s/^  #   /    /g' docker-compose.yml 2>/dev/null || true
        print_success "PostgreSQL service enabled"
    fi
}

# Build and start services
start_services() {
    print_header "Starting Services"
    
    print_info "Building Docker images..."
    docker-compose build
    
    print_success "Docker images built successfully"
    
    print_info "Starting containers..."
    docker-compose up -d
    
    print_success "Containers started successfully"
    
    # Wait for services to be ready
    print_info "Waiting for services to be ready..."
    sleep 5
    
    local port=$(grep ^PORT= .env | cut -d '=' -f2)
    port=${port:-5000}
    
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:$port >/dev/null 2>&1; then
            print_success "Application is ready!"
            break
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_warning "Application may still be starting up"
    fi
}

# Display completion message
display_completion() {
    print_header "Setup Complete!"
    
    local port=$(grep ^PORT= .env | cut -d '=' -f2)
    port=${port:-5000}
    
    # Check which AI providers are configured
    local ai_providers=()
    grep -q "^ANTHROPIC_API_KEY=.\+" .env 2>/dev/null && ai_providers+=("Claude")
    grep -q "^OPENAI_API_KEY=.\+" .env 2>/dev/null && ai_providers+=("GPT-4")
    grep -q "^DEEPSEEK_API_KEY=.\+" .env 2>/dev/null && ai_providers+=("DeepSeek")
    grep -q "^XAI_API_KEY=.\+" .env 2>/dev/null && ai_providers+=("Grok")
    grep -q "^QWEN_API_KEY=.\+" .env 2>/dev/null && ai_providers+=("Qwen")
    
    echo -e "${GREEN}"
    cat << EOF

┌─────────────────────────────────────────────────┐
│  Astroid Trading Bot is now running!           │
└─────────────────────────────────────────────────┘

EOF
    echo -e "${NC}"
    
    print_info "Dashboard URL: ${BLUE}http://localhost:$port${NC}"
    echo ""
    
    if [ ${#ai_providers[@]} -gt 0 ]; then
        print_success "AI Trading Agents enabled with: ${ai_providers[*]}"
        print_info "Navigate to the AI Agents tab to create autonomous trading agents"
        echo ""
    else
        print_warning "No AI providers configured - only traditional volume bots available"
        print_info "To enable AI agents, add API keys to .env file and restart"
        echo ""
    fi
    
    print_info "Features available:"
    echo "  • Traditional Volume Bots - Automated market making"
    [ ${#ai_providers[@]} -gt 0 ] && echo "  • AI Trading Agents - Autonomous trading with dual profit/loss targets"
    echo "  • Real-time WebSocket updates"
    echo "  • Mobile-responsive dashboard"
    echo "  • Comprehensive trading analytics"
    echo ""
    
    print_info "Useful commands:"
    echo "  • View logs:       docker-compose logs -f"
    echo "  • Stop services:   docker-compose stop"
    echo "  • Start services:  docker-compose start"
    echo "  • Restart:         docker-compose restart"
    echo "  • Remove all:      docker-compose down"
    echo ""
    print_success "Setup wizard completed successfully!"
    echo ""
}

# Main execution
main() {
    clear
    print_banner
    
    print_info "Welcome to the Astroid trading bot setup wizard!"
    print_info "This script will help you get started quickly and easily."
    echo ""
    
    # Step 1: Check prerequisites
    check_prerequisites
    
    # Step 2: Create environment configuration
    create_env_file
    
    # Step 3: Ask if user wants to start now
    echo ""
    read -p "Do you want to start the services now? (Y/n): " start_now
    if [[ ! $start_now =~ ^[Nn]$ ]]; then
        start_services
        display_completion
    else
        print_info "You can start the services later with: docker-compose up -d"
    fi
}

# Run main function
main
