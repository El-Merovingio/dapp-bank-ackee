// TODO: Bank
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { FC, useState } from 'react';
import { Program, AnchorProvider, web3, utils, BN } from "@project-serum/anchor"
import idl from "./solanapdas.json"
import { PublicKey } from '@solana/web3.js';
import useUserSOLBalanceStore from '../stores/useUserSOLBalanceStore';


const idl_string = JSON.stringify(idl)
const idl_object = JSON.parse(idl_string)
const programID = new PublicKey(idl.metadata.address)

export const Bank: FC = () => {
    const { publicKey, signMessage } = useWallet()
    const { connection } = useConnection()
    const myWallet = useWallet()
    const balance = useUserSOLBalanceStore((s) => s.balance)
    const { getUserSOLBalance } = useUserSOLBalanceStore()

    const [banks, setBanks] = useState([]) // returns the results in an array, so []

    const getProvider = () => {
        const provider = new AnchorProvider(connection, myWallet, AnchorProvider.defaultOptions())
        return provider
    }

    const createBank = async () => {
        try {
            const myProvider = getProvider() // get the provider
            const program = new Program(idl_object, programID, myProvider) // idl parsed from, program, provider

            // create the PDA using the seeed
            // seeds=[b"bankaccount", user.key().as_ref()
            const [bank] = await PublicKey.findProgramAddressSync([
                utils.bytes.utf8.encode("bankaccount"), // first seed
                myProvider.wallet.publicKey.toBuffer(), // the user address who is creating the bank
            ], program.programId)
            // the bump is automatically added


            // awaits for AnchorProvider.defaultOptions() confirmation, or finalization
            await program.rpc.create("Julio Bank", // args from IDL -> "name": "name","type": "string"
                {
                    // accounts expected for crete instruction 
                    accounts: {
                        bank,
                        user: myProvider.wallet.publicKey,
                        systemProgram: web3.SystemProgram.programId
                    }
                }
            )

            console.log("New bank created with the address: " + bank.toString())
        } catch (error) {

            console.log("Error while creating the bank: " + error)
        }
    }

    // LIST RELATED ACCOUNTS WITH THE BANK AND ITS CONTENTS
    const getBanks = async () => {
        const myProvider = getProvider()
        const program = new Program(idl_object, programID, myProvider)

        try {
            // The promises will change
            Promise.all((await connection.getProgramAccounts(programID)) // UI connection, not Anchor connection
                .map(async bank => ({
                    // for each one of the accounts but we need more info, such bank pubkey
                    ...(await program.account.bank.fetch(bank.pubkey)),
                    pubkey: bank.pubkey
                })))
                // printout in a console
                .then(banks => {
                    console.log(banks)
                    // we want to display to UI level in our return func, so we create a new state
                    // we declare const [banks, setBanks] = useState() up
                    setBanks(banks)
                })

        } catch (error) {
            console.log("Error during fetching banks: " + error)

        }
    }


    const depositBank = async (publicKey) => {
        try {
            // copy the same
            const myProvider = getProvider()
            const program = new Program(idl_object, programID, myProvider)

            await program.rpc.deposit(new BN(0.1 * web3.LAMPORTS_PER_SOL), // BigNumber must be in lamports
                {
                    accounts:
                    {
                        bank: publicKey,
                        user: myProvider.wallet.publicKey,  // is the signer 
                        systemProgram: web3.SystemProgram.programId
                    }
                }
            )

            console.log("Deposit done by: " + publicKey)
            getUserSOLBalance(publicKey, connection)

        } catch (error) {
            console.error("Error while depositing: + " + error) // .error to be visible by the console

        }
    }


    const withdrawBank = async (publicKey) => {
        // using some of the deposit
        const myProvider = getProvider()
        const program = new Program(idl_object, programID, myProvider)
        // https://docs.solana.com/es/developing/clients/javascript-reference
        const nonceInfo = await connection.getAccountInfo(publicKey, 'confirmed')
        const solRent = await connection.getMinimumBalanceForRentExemption(nonceInfo.data.length)
        const withAmount = (await connection.getBalance(publicKey)) - solRent

        try {

            await program.rpc.withdraw(new BN(withAmount), // BigNumber must be in lamports
                {
                    accounts:
                    {
                        bank: publicKey,
                        user: myProvider.wallet.publicKey,  // is the signer 
                    }
                }
            )
            console.log("Withdraw of " + withAmount + " lamports done by: " + myProvider.wallet.publicKey + " from the bank address: " + publicKey)
            getUserSOLBalance(publicKey, connection)

        } catch (error) {
            console.error("Error while withdrawing: + " + error)
        }

    }

    return (
        <> {/* set key in div to avoid error of unique key required*/}
            {banks.map((bank) => {
                return (
                    <div className="md:hero-content flex flex-col" key={bank.pubkey.toString()}>
                        <h1><b>Bank Name:</b> {bank.name.toString()}</h1>
                        <span><b>Bank Address:</b> {bank.pubkey.toString()}</span>
                        <span><b>Bank Owner:</b> {bank.owner.toString()}</span>
                        <span><b>Bank Balance:</b> {(balance || 0).toLocaleString()} <b>lamports</b></span>
                        <button
                            className="group w-60 m-2 btn animate-pulse bg-gradient-to-br from-indigo-500 to-fuchsia-500 hover:from-white hover:to-purple-300 text-black"
                            onClick={() => depositBank(bank.pubkey)}
                        >
                            <div className="hidden group-disabled:block">
                                Wallet not connected
                            </div>
                            <span className="block group-disabled:hidden" >
                                Deposit 0.1 SOL
                            </span>
                        </button>

                        <button
                            className="group w-60 m-2 btn animate-pulse bg-gradient-to-br from-indigo-500 to-fuchsia-500 hover:from-white hover:to-purple-300 text-black"
                            onClick={() => withdrawBank(bank.pubkey)}
                        >
                            <div className="hidden group-disabled:block">
                                Wallet not connected
                            </div>
                            <span className="block group-disabled:hidden" >
                                Withdraw
                            </span>
                        </button>

                    </div>
                )
            })}




            <div className="flex flex-row justify-center">
                <>
                    <div className="relative group items-center">
                        <div className="m-1 absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-fuchsia-500 
                rounded-lg blur opacity-20 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>

                        <button
                            className="group w-60 m-2 btn animate-pulse bg-gradient-to-br from-indigo-500 to-fuchsia-500 hover:from-white hover:to-purple-300 text-black"
                            onClick={createBank} disabled={!publicKey}
                        >
                            <div className="hidden group-disabled:block">
                                Wallet not connected
                            </div>
                            <span className="block group-disabled:hidden" >
                                Create Bank
                            </span>
                        </button>

                        <button
                            className="group w-60 m-2 btn animate-pulse bg-gradient-to-br from-indigo-500 to-fuchsia-500 hover:from-white hover:to-purple-300 text-black"
                            onClick={getBanks} disabled={!publicKey}
                        >
                            <div className="hidden group-disabled:block">
                                Wallet not connected
                            </div>
                            <span className="block group-disabled:hidden" >
                                Fetch Banks
                            </span>
                        </button>

                    </div>
                </>
            </div>
        </>
    )
};